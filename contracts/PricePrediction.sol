// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PricePrediction
 * @dev A decentralized price prediction game where users stake ETH on their predictions
 */
contract PricePrediction {
    // Prediction struct
    struct Prediction {
        address predictor;
        string asset;
        uint256 startPrice;      // Price at prediction time (scaled by 1e8)
        uint256 predictedPrice;  // User's predicted price (scaled by 1e8)
        uint256 stakeAmount;     // ETH staked
        uint256 createdAt;
        uint256 expiresAt;
        bool settled;
        bool won;
        uint256 payout;
    }

    // State variables
    address public owner;
    uint256 public predictionCount;
    uint256 public minStake = 0.001 ether;
    uint256 public maxStake = 10 ether;
    uint256 public platformFeePercent = 5; // 5%
    uint256 public totalFeesCollected;

    // Mappings
    mapping(uint256 => Prediction) public predictions;
    mapping(address => uint256[]) public userPredictions;

    // Events
    event PredictionCreated(
        uint256 indexed predictionId,
        address indexed predictor,
        string asset,
        uint256 startPrice,
        uint256 predictedPrice,
        uint256 stakeAmount,
        uint256 expiresAt
    );

    event PredictionSettled(
        uint256 indexed predictionId,
        address indexed predictor,
        bool won,
        uint256 payout,
        uint256 actualPrice,
        uint256 errorPercent
    );

    event StakeLimitsUpdated(uint256 minStake, uint256 maxStake);
    event FeesWithdrawn(address indexed to, uint256 amount);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Create a new price prediction
     * @param asset The asset symbol (e.g., "SPY", "BTC-USD")
     * @param startPrice Current price of the asset (scaled by 1e8)
     * @param predictedPrice User's predicted price (scaled by 1e8)
     * @param expiresAt Timestamp when prediction expires
     */
    function createPrediction(
        string calldata asset,
        uint256 startPrice,
        uint256 predictedPrice,
        uint256 expiresAt
    ) external payable returns (uint256) {
        require(msg.value >= minStake, "Stake below minimum");
        require(msg.value <= maxStake, "Stake above maximum");
        require(expiresAt > block.timestamp, "Expiry must be in future");
        require(expiresAt <= block.timestamp + 365 days, "Expiry too far");
        require(startPrice > 0, "Invalid start price");
        require(predictedPrice > 0, "Invalid predicted price");
        require(bytes(asset).length > 0, "Asset required");

        uint256 predictionId = predictionCount++;

        predictions[predictionId] = Prediction({
            predictor: msg.sender,
            asset: asset,
            startPrice: startPrice,
            predictedPrice: predictedPrice,
            stakeAmount: msg.value,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            settled: false,
            won: false,
            payout: 0
        });

        userPredictions[msg.sender].push(predictionId);

        emit PredictionCreated(
            predictionId,
            msg.sender,
            asset,
            startPrice,
            predictedPrice,
            msg.value,
            expiresAt
        );

        return predictionId;
    }

    /**
     * @dev Settle a prediction (can be called by anyone after expiry)
     * @param predictionId The prediction to settle
     * @param actualPrice The actual price at expiry (scaled by 1e8)
     * @notice In production, this would use Chainlink oracles for price feeds
     */
    function settlePrediction(uint256 predictionId, uint256 actualPrice) external onlyOwner {
        Prediction storage pred = predictions[predictionId];

        require(!pred.settled, "Already settled");
        require(block.timestamp >= pred.expiresAt, "Not expired yet");
        require(actualPrice > 0, "Invalid actual price");

        pred.settled = true;

        // Calculate error percentage (scaled by 1e4 for precision)
        uint256 errorPercent = calculateErrorPercent(pred.predictedPrice, actualPrice);

        // Calculate multiplier based on accuracy
        uint256 multiplier = calculateMultiplier(errorPercent);

        if (multiplier > 0) {
            pred.won = true;
            uint256 grossPayout = (pred.stakeAmount * multiplier) / 100;
            uint256 fee = (grossPayout * platformFeePercent) / 100;
            pred.payout = grossPayout - fee;
            totalFeesCollected += fee;

            // Transfer payout to predictor
            (bool success, ) = pred.predictor.call{value: pred.payout}("");
            require(success, "Transfer failed");
        } else {
            pred.won = false;
            pred.payout = 0;
            // Lost stake goes to platform
            totalFeesCollected += pred.stakeAmount;
        }

        emit PredictionSettled(
            predictionId,
            pred.predictor,
            pred.won,
            pred.payout,
            actualPrice,
            errorPercent
        );
    }

    /**
     * @dev Calculate error percentage between predicted and actual price
     * @return Error percentage scaled by 1e4 (e.g., 250 = 2.5%)
     */
    function calculateErrorPercent(uint256 predicted, uint256 actual) public pure returns (uint256) {
        uint256 diff = predicted > actual ? predicted - actual : actual - predicted;
        return (diff * 10000) / actual;
    }

    /**
     * @dev Calculate payout multiplier based on prediction accuracy
     * @param errorPercent Error percentage scaled by 1e4
     * @return Multiplier scaled by 100 (e.g., 1000 = 10x)
     */
    function calculateMultiplier(uint256 errorPercent) public pure returns (uint256) {
        if (errorPercent <= 100) {        // ±1%
            return 1000;  // 10x
        } else if (errorPercent <= 250) { // ±2.5%
            return 500;   // 5x
        } else if (errorPercent <= 500) { // ±5%
            return 200;   // 2x
        } else if (errorPercent <= 1000) { // ±10%
            return 100;   // 1x (get stake back)
        } else {
            return 0;     // Lost
        }
    }

    /**
     * @dev Get all prediction IDs for a user
     */
    function getUserPredictions(address user) external view returns (uint256[] memory) {
        return userPredictions[user];
    }

    /**
     * @dev Get prediction details
     */
    function getPrediction(uint256 predictionId) external view returns (
        address predictor,
        string memory asset,
        uint256 startPrice,
        uint256 predictedPrice,
        uint256 stakeAmount,
        uint256 createdAt,
        uint256 expiresAt,
        bool settled,
        bool won,
        uint256 payout
    ) {
        Prediction storage pred = predictions[predictionId];
        return (
            pred.predictor,
            pred.asset,
            pred.startPrice,
            pred.predictedPrice,
            pred.stakeAmount,
            pred.createdAt,
            pred.expiresAt,
            pred.settled,
            pred.won,
            pred.payout
        );
    }

    /**
     * @dev Update stake limits (owner only)
     */
    function updateStakeLimits(uint256 _minStake, uint256 _maxStake) external onlyOwner {
        require(_minStake < _maxStake, "Invalid limits");
        minStake = _minStake;
        maxStake = _maxStake;
        emit StakeLimitsUpdated(_minStake, _maxStake);
    }

    /**
     * @dev Withdraw collected fees (owner only)
     */
    function withdrawFees(address payable to) external onlyOwner {
        uint256 amount = totalFeesCollected;
        require(amount > 0, "No fees to withdraw");
        totalFeesCollected = 0;
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
        emit FeesWithdrawn(to, amount);
    }

    /**
     * @dev Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    /**
     * @dev Receive ETH (for funding payouts)
     */
    receive() external payable {}
}
