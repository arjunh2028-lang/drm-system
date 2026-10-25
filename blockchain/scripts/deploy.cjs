const hre = require('hardhat');

async function main() {
  const registry = await hre.ethers.deployContract('DRMRegistry');
  await registry.waitForDeployment();
  console.log(`DRMRegistry deployed to ${await registry.getAddress()}`);
  console.log(`Chain ID: ${(await hre.ethers.provider.getNetwork()).chainId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
