// ================================================
// Web3 Integration Module
// ================================================

// Contract ABI (Application Binary Interface)
const PREDICTION_CONTRACT_ABI = [
    // Read functions
    "function owner() view returns (address)",
    "function predictionCount() view returns (uint256)",
    "function minStake() view returns (uint256)",
    "function maxStake() view returns (uint256)",
    "function predictions(uint256) view returns (address predictor, string asset, uint256 startPrice, uint256 predictedPrice, uint256 stakeAmount, uint256 createdAt, uint256 expiresAt, bool settled, bool won, uint256 payout)",
    "function getUserPredictions(address user) view returns (uint256[])",
    "function getPrediction(uint256 predictionId) view returns (address predictor, string asset, uint256 startPrice, uint256 predictedPrice, uint256 stakeAmount, uint256 createdAt, uint256 expiresAt, bool settled, bool won, uint256 payout)",
    "function calculateErrorPercent(uint256 predicted, uint256 actual) pure returns (uint256)",
    "function calculateMultiplier(uint256 errorPercent) pure returns (uint256)",

    // Write functions
    "function createPrediction(string asset, uint256 startPrice, uint256 predictedPrice, uint256 expiresAt) payable returns (uint256)",

    // Events
    "event PredictionCreated(uint256 indexed predictionId, address indexed predictor, string asset, uint256 startPrice, uint256 predictedPrice, uint256 stakeAmount, uint256 expiresAt)",
    "event PredictionSettled(uint256 indexed predictionId, address indexed predictor, bool won, uint256 payout, uint256 actualPrice, uint256 errorPercent)"
];

// Network configurations
const NETWORKS = {
    sepolia: {
        chainId: '0xaa36a7', // 11155111 in hex
        chainIdDecimal: 11155111,
        chainName: 'Sepolia Testnet',
        nativeCurrency: {
            name: 'Sepolia ETH',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://sepolia.infura.io/v3/YOUR_INFURA_KEY', 'https://rpc.sepolia.org'],
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
        // Contract address - update after deployment
        contractAddress: null
    },
    holesky: {
        chainId: '0x4268', // 17000 in hex
        chainIdDecimal: 17000,
        chainName: 'Holesky Testnet',
        nativeCurrency: {
            name: 'Holesky ETH',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://ethereum-holesky.publicnode.com'],
        blockExplorerUrls: ['https://holesky.etherscan.io'],
        contractAddress: null
    },
    localhost: {
        chainId: '0x7a69', // 31337 in hex (Hardhat default)
        chainIdDecimal: 31337,
        chainName: 'Localhost',
        nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['http://127.0.0.1:8545'],
        blockExplorerUrls: [],
        contractAddress: null
    }
};

// Web3 state
const web3State = {
    provider: null,
    signer: null,
    contract: null,
    address: null,
    chainId: null,
    network: null,
    isConnected: false
};

// Active network - change this to switch networks
let activeNetwork = 'sepolia';

// ================================================
// Connection Functions
// ================================================

/**
 * Check if MetaMask or another Web3 wallet is available
 */
function isWeb3Available() {
    return typeof window.ethereum !== 'undefined';
}

/**
 * Connect to Web3 wallet
 */
async function connectWeb3Wallet() {
    if (!isWeb3Available()) {
        throw new Error('No Web3 wallet detected. Please install MetaMask.');
    }

    try {
        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (accounts.length === 0) {
            throw new Error('No accounts found. Please unlock your wallet.');
        }

        // Create ethers provider and signer
        web3State.provider = new ethers.BrowserProvider(window.ethereum);
        web3State.signer = await web3State.provider.getSigner();
        web3State.address = accounts[0];

        // Get current chain ID
        const network = await web3State.provider.getNetwork();
        web3State.chainId = Number(network.chainId);

        // Determine network name
        web3State.network = Object.keys(NETWORKS).find(
            key => NETWORKS[key].chainIdDecimal === web3State.chainId
        ) || 'unknown';

        // Setup contract if on correct network
        await setupContract();

        web3State.isConnected = true;

        // Setup event listeners
        setupWeb3EventListeners();

        return {
            address: web3State.address,
            chainId: web3State.chainId,
            network: web3State.network
        };

    } catch (error) {
        console.error('Failed to connect wallet:', error);
        throw error;
    }
}

/**
 * Setup contract instance
 */
async function setupContract() {
    const networkConfig = NETWORKS[activeNetwork];

    if (!networkConfig || !networkConfig.contractAddress) {
        console.warn('Contract not deployed on this network yet');
        web3State.contract = null;
        return;
    }

    // Check if we're on the correct network
    if (web3State.chainId !== networkConfig.chainIdDecimal) {
        console.warn(`Please switch to ${networkConfig.chainName}`);
        return;
    }

    web3State.contract = new ethers.Contract(
        networkConfig.contractAddress,
        PREDICTION_CONTRACT_ABI,
        web3State.signer
    );
}

/**
 * Setup Web3 event listeners for account and chain changes
 */
function setupWeb3EventListeners() {
    if (!window.ethereum) return;

    // Handle account changes
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
            // User disconnected wallet
            disconnectWeb3Wallet();
        } else {
            // User switched accounts
            web3State.address = accounts[0];
            web3State.signer = await web3State.provider.getSigner();
            await setupContract();

            // Dispatch custom event
            window.dispatchEvent(new CustomEvent('web3AccountChanged', {
                detail: { address: web3State.address }
            }));
        }
    });

    // Handle chain changes
    window.ethereum.on('chainChanged', async (chainId) => {
        web3State.chainId = parseInt(chainId, 16);
        web3State.network = Object.keys(NETWORKS).find(
            key => NETWORKS[key].chainIdDecimal === web3State.chainId
        ) || 'unknown';

        await setupContract();

        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('web3ChainChanged', {
            detail: { chainId: web3State.chainId, network: web3State.network }
        }));
    });
}

/**
 * Disconnect wallet
 */
function disconnectWeb3Wallet() {
    web3State.provider = null;
    web3State.signer = null;
    web3State.contract = null;
    web3State.address = null;
    web3State.chainId = null;
    web3State.network = null;
    web3State.isConnected = false;

    window.dispatchEvent(new CustomEvent('web3Disconnected'));
}

/**
 * Switch to the correct network
 */
async function switchNetwork(networkName) {
    const network = NETWORKS[networkName];
    if (!network) {
        throw new Error('Unknown network');
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: network.chainId }]
        });
    } catch (switchError) {
        // Chain not added to wallet, try to add it
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: network.chainId,
                    chainName: network.chainName,
                    nativeCurrency: network.nativeCurrency,
                    rpcUrls: network.rpcUrls,
                    blockExplorerUrls: network.blockExplorerUrls
                }]
            });
        } else {
            throw switchError;
        }
    }
}

// ================================================
// Contract Interaction Functions
// ================================================

/**
 * Create a new prediction on-chain
 * @param {string} asset - Asset symbol
 * @param {number} startPrice - Current price
 * @param {number} predictedPrice - Predicted price
 * @param {Date} expiryDate - Expiry date
 * @param {string} stakeAmountEth - Stake amount in ETH
 */
async function createOnChainPrediction(asset, startPrice, predictedPrice, expiryDate, stakeAmountEth) {
    if (!web3State.contract) {
        throw new Error('Contract not available. Please connect to the correct network.');
    }

    // Convert prices to uint256 (scaled by 1e8)
    const startPriceScaled = BigInt(Math.round(startPrice * 1e8));
    const predictedPriceScaled = BigInt(Math.round(predictedPrice * 1e8));

    // Convert expiry to Unix timestamp
    const expiryTimestamp = Math.floor(expiryDate.getTime() / 1000);

    // Convert stake to wei
    const stakeWei = ethers.parseEther(stakeAmountEth.toString());

    try {
        // Send transaction
        const tx = await web3State.contract.createPrediction(
            asset,
            startPriceScaled,
            predictedPriceScaled,
            expiryTimestamp,
            { value: stakeWei }
        );

        // Wait for confirmation
        const receipt = await tx.wait();

        // Parse events to get prediction ID
        const event = receipt.logs.find(log => {
            try {
                const parsed = web3State.contract.interface.parseLog(log);
                return parsed.name === 'PredictionCreated';
            } catch {
                return false;
            }
        });

        let predictionId = null;
        if (event) {
            const parsed = web3State.contract.interface.parseLog(event);
            predictionId = parsed.args[0].toString();
        }

        return {
            success: true,
            transactionHash: receipt.hash,
            predictionId,
            blockNumber: receipt.blockNumber
        };

    } catch (error) {
        console.error('Transaction failed:', error);

        // Parse common errors
        if (error.code === 'ACTION_REJECTED') {
            throw new Error('Transaction was rejected by user');
        }
        if (error.message.includes('insufficient funds')) {
            throw new Error('Insufficient funds for transaction');
        }

        throw error;
    }
}

/**
 * Get user's predictions from the contract
 */
async function getUserOnChainPredictions() {
    if (!web3State.contract || !web3State.address) {
        return [];
    }

    try {
        const predictionIds = await web3State.contract.getUserPredictions(web3State.address);
        const predictions = [];

        for (const id of predictionIds) {
            const pred = await web3State.contract.getPrediction(id);
            predictions.push({
                id: id.toString(),
                predictor: pred.predictor,
                asset: pred.asset,
                startPrice: Number(pred.startPrice) / 1e8,
                predictedPrice: Number(pred.predictedPrice) / 1e8,
                stakeAmount: ethers.formatEther(pred.stakeAmount),
                createdAt: new Date(Number(pred.createdAt) * 1000),
                expiresAt: new Date(Number(pred.expiresAt) * 1000),
                settled: pred.settled,
                won: pred.won,
                payout: ethers.formatEther(pred.payout)
            });
        }

        return predictions;

    } catch (error) {
        console.error('Failed to fetch predictions:', error);
        return [];
    }
}

/**
 * Get contract stats
 */
async function getContractStats() {
    if (!web3State.contract) {
        return null;
    }

    try {
        const [predictionCount, minStake, maxStake] = await Promise.all([
            web3State.contract.predictionCount(),
            web3State.contract.minStake(),
            web3State.contract.maxStake()
        ]);

        return {
            totalPredictions: Number(predictionCount),
            minStake: ethers.formatEther(minStake),
            maxStake: ethers.formatEther(maxStake)
        };

    } catch (error) {
        console.error('Failed to fetch contract stats:', error);
        return null;
    }
}

// ================================================
// Utility Functions
// ================================================

/**
 * Format address for display
 */
function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get block explorer URL for transaction
 */
function getExplorerUrl(txHash) {
    const network = NETWORKS[web3State.network];
    if (!network || !network.blockExplorerUrls[0]) {
        return null;
    }
    return `${network.blockExplorerUrls[0]}/tx/${txHash}`;
}

/**
 * Get network display name
 */
function getNetworkName() {
    const network = NETWORKS[web3State.network];
    return network ? network.chainName : 'Unknown Network';
}

/**
 * Check if on correct network
 */
function isOnCorrectNetwork() {
    return web3State.network === activeNetwork;
}

/**
 * Set the contract address (call after deployment)
 */
function setContractAddress(networkName, address) {
    if (NETWORKS[networkName]) {
        NETWORKS[networkName].contractAddress = address;
    }
}

// Export for use in other modules
window.Web3Integration = {
    // State
    state: web3State,
    networks: NETWORKS,

    // Connection
    isWeb3Available,
    connectWeb3Wallet,
    disconnectWeb3Wallet,
    switchNetwork,
    isOnCorrectNetwork,
    getNetworkName,

    // Contract
    createOnChainPrediction,
    getUserOnChainPredictions,
    getContractStats,
    setContractAddress,

    // Utils
    formatAddress,
    getExplorerUrl
};
