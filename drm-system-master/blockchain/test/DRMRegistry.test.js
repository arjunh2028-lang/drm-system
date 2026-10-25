const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('DRMRegistry', function () {
  async function deploy() {
    const [issuer, owner, licensee, stranger] = await ethers.getSigners();
    const registry = await ethers.deployContract('DRMRegistry');
    await registry.waitForDeployment();
    const assetId = 7n;
    const hash = ethers.sha256(ethers.toUtf8Bytes('content bytes'));
    const view = ethers.id('VIEW');
    return { registry, issuer, owner, licensee, stranger, assetId, hash, view };
  }

  it('registers an asset with its exact hash and owner', async function () {
    const { registry, owner, assetId, hash } = await deploy();
    await expect(registry.registerAsset(assetId, hash, owner.address))
      .to.emit(registry, 'AssetRegistered').withArgs(assetId, hash, owner.address);
    const record = await registry.assets(assetId);
    expect(record.contentHash).to.equal(hash);
    expect(record.owner).to.equal(owner.address);
    expect(record.registered).to.equal(true);
    expect(await registry.isAssetOwner(assetId, owner.address)).to.equal(true);
  });

  it('rejects unauthorized registration, invalid assets, and duplicates', async function () {
    const { registry, owner, stranger, assetId, hash, licensee, view } = await deploy();
    await expect(registry.connect(stranger).registerAsset(assetId, hash, owner.address)).to.be.revertedWithCustomError(registry, 'Unauthorized');
    await expect(registry.registerAsset(assetId, ethers.ZeroHash, owner.address)).to.be.revertedWithCustomError(registry, 'InvalidInput');
    await expect(registry.grantLicense(assetId, licensee.address, view, 0)).to.be.revertedWithCustomError(registry, 'InvalidAsset');
    await registry.registerAsset(assetId, hash, owner.address);
    await expect(registry.registerAsset(assetId, hash, owner.address)).to.be.revertedWithCustomError(registry, 'AlreadyRegistered');
  });

  it('issues no-expiry and expiring licenses, and rejects wrong rights', async function () {
    const { registry, owner, licensee, assetId, hash, view } = await deploy();
    await registry.registerAsset(assetId, hash, owner.address);
    await registry.grantLicense(assetId, licensee.address, view, 0);
    expect(await registry.isLicenseValid(assetId, licensee.address, view)).to.equal(true);
    const latest = await ethers.provider.getBlock('latest');
    await registry.grantLicense(assetId, licensee.address, ethers.id('DOWNLOAD'), latest.timestamp + 100);
    expect(await registry.isLicenseValid(assetId, licensee.address, ethers.id('SHARE'))).to.equal(false);
    expect(await registry.isLicenseValid(assetId, licensee.address, ethers.id('DOWNLOAD'))).to.equal(true);
    await ethers.provider.send('evm_increaseTime', [200]);
    await ethers.provider.send('evm_mine', []);
    expect(await registry.isLicenseValid(assetId, licensee.address, ethers.id('DOWNLOAD'))).to.equal(false);
  });

  it('rejects unauthorized grants/revokes and denies expired or revoked licenses', async function () {
    const { registry, owner, licensee, stranger, assetId, hash, view } = await deploy();
    await registry.registerAsset(assetId, hash, owner.address);
    await expect(registry.connect(stranger).grantLicense(assetId, licensee.address, view, 0)).to.be.revertedWithCustomError(registry, 'Unauthorized');
    await registry.grantLicense(assetId, licensee.address, view, 0);
    await expect(registry.connect(stranger).revokeLicense(assetId, licensee.address, view)).to.be.revertedWithCustomError(registry, 'Unauthorized');
    await registry.revokeLicense(assetId, licensee.address, view);
    expect(await registry.isLicenseValid(assetId, licensee.address, view)).to.equal(false);
    await expect(registry.revokeLicense(assetId, licensee.address, view)).to.be.revertedWithCustomError(registry, 'InvalidInput');
  });

  it('rejects already-expired grants', async function () {
    const { registry, owner, licensee, assetId, hash, view } = await deploy();
    await registry.registerAsset(assetId, hash, owner.address);
    const latest = await ethers.provider.getBlock('latest');
    await expect(registry.grantLicense(assetId, licensee.address, view, latest.timestamp)).to.be.revertedWithCustomError(registry, 'InvalidInput');
    await expect(registry.grantLicense(assetId, owner.address, view, 0)).to.be.revertedWithCustomError(registry, 'InvalidInput');
  });
});
