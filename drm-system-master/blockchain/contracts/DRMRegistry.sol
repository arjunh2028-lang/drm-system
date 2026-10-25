// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice V1 registry. A single backend issuer is trusted to submit transactions;
/// user and owner addresses are verified by the application before submission.
contract DRMRegistry {
    address public immutable issuer;

    struct Asset {
        bytes32 contentHash;
        address owner;
        bool registered;
    }

    struct License {
        uint64 issuedAt;
        uint64 expiresAt; // 0 means no expiration.
        bool revoked;
    }

    mapping(uint256 => Asset) public assets;
    mapping(uint256 => mapping(address => mapping(bytes32 => License))) public licenses;

    bytes32 public constant VIEW = keccak256("VIEW");
    bytes32 public constant DOWNLOAD = keccak256("DOWNLOAD");
    bytes32 public constant SHARE = keccak256("SHARE");

    event AssetRegistered(uint256 indexed assetId, bytes32 contentHash, address indexed owner);
    event LicenseGranted(uint256 indexed assetId, address indexed licensee, bytes32 indexed rightType, uint64 issuedAt, uint64 expiresAt);
    event LicenseRevoked(uint256 indexed assetId, address indexed licensee, bytes32 indexed rightType);

    error Unauthorized();
    error InvalidAsset();
    error InvalidInput();
    error AlreadyRegistered();

    constructor() { issuer = msg.sender; }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert Unauthorized();
        _;
    }

    function registerAsset(uint256 assetId, bytes32 contentHash, address owner) external onlyIssuer {
        if (assetId == 0 || contentHash == bytes32(0) || owner == address(0)) revert InvalidInput();
        if (assets[assetId].registered) revert AlreadyRegistered();
        assets[assetId] = Asset(contentHash, owner, true);
        emit AssetRegistered(assetId, contentHash, owner);
    }

    function grantLicense(uint256 assetId, address licensee, bytes32 rightType, uint64 expiresAt) external onlyIssuer {
        Asset memory asset = assets[assetId];
        if (!asset.registered) revert InvalidAsset();
        if (licensee == address(0) || licensee == asset.owner || !_validRight(rightType)) revert InvalidInput();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert InvalidInput();
        licenses[assetId][licensee][rightType] = License(uint64(block.timestamp), expiresAt, false);
        emit LicenseGranted(assetId, licensee, rightType, uint64(block.timestamp), expiresAt);
    }

    function revokeLicense(uint256 assetId, address licensee, bytes32 rightType) external onlyIssuer {
        if (!assets[assetId].registered) revert InvalidAsset();
        License storage license = licenses[assetId][licensee][rightType];
        if (license.issuedAt == 0 || license.revoked) revert InvalidInput();
        license.revoked = true;
        emit LicenseRevoked(assetId, licensee, rightType);
    }

    function isLicenseValid(uint256 assetId, address licensee, bytes32 rightType) external view returns (bool) {
        if (!assets[assetId].registered || !_validRight(rightType)) return false;
        License memory license = licenses[assetId][licensee][rightType];
        return license.issuedAt != 0 && !license.revoked && (license.expiresAt == 0 || block.timestamp < license.expiresAt);
    }

    function isAssetOwner(uint256 assetId, address account) external view returns (bool) {
        return assets[assetId].registered && assets[assetId].owner == account;
    }

    function _validRight(bytes32 rightType) private pure returns (bool) {
        return rightType == VIEW || rightType == DOWNLOAD || rightType == SHARE;
    }
}
