const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying PricePrediction contract...\n");

  // Get the deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

  // Deploy the contract
  const PricePrediction = await hre.ethers.getContractFactory("PricePrediction");
  const prediction = await PricePrediction.deploy();

  await prediction.waitForDeployment();
  const contractAddress = await prediction.getAddress();

  console.log("PricePrediction deployed to:", contractAddress);
  console.log("Transaction hash:", prediction.deploymentTransaction().hash);

  // Wait for confirmations
  console.log("\nWaiting for confirmations...");
  await prediction.deploymentTransaction().wait(5);
  console.log("Confirmed!");

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;

  // Save deployment info
  const deploymentInfo = {
    network: networkName,
    chainId: Number(network.chainId),
    contractAddress: contractAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    transactionHash: prediction.deploymentTransaction().hash
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  // Save deployment info to file
  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  // Update web3.js with contract address
  console.log("\n--- IMPORTANT ---");
  console.log("Update your web3.js with the contract address:");
  console.log(`Web3Integration.setContractAddress('${networkName}', '${contractAddress}');`);
  console.log("\nOr add to NETWORKS config:");
  console.log(`${networkName}: { contractAddress: '${contractAddress}' }`);

  // Verify on Etherscan (if not localhost)
  if (networkName !== "localhost" && networkName !== "hardhat") {
    console.log("\nVerifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: []
      });
      console.log("Contract verified on Etherscan!");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("Contract already verified!");
      } else {
        console.log("Verification failed:", error.message);
        console.log("You can verify manually later with:");
        console.log(`npx hardhat verify --network ${networkName} ${contractAddress}`);
      }
    }
  }

  // Print contract info
  console.log("\n--- Contract Info ---");
  const minStake = await prediction.minStake();
  const maxStake = await prediction.maxStake();
  console.log("Min stake:", hre.ethers.formatEther(minStake), "ETH");
  console.log("Max stake:", hre.ethers.formatEther(maxStake), "ETH");
  console.log("Owner:", await prediction.owner());

  return contractAddress;
}

// Run deployment
main()
  .then((address) => {
    console.log("\nDeployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
