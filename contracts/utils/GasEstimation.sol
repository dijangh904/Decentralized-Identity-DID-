// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../interfaces/IERC725.sol";
import "../interfaces/IERC735.sol";

/**
 * @title GasEstimation
 * @dev Comprehensive gas estimation utility for all DID contract operations
 * 
 * This contract provides gas estimation functions for all major DID operations
 * including DID creation, credential management, governance operations, and
 * recovery procedures. It uses historical data and dynamic pricing to provide
 * accurate gas estimates.
 * 
 * Features:
 * - Real-time gas estimation for all operations
 * - Historical gas usage tracking
 * - Dynamic pricing based on network conditions
 * - Batch operation optimization
 * - Gas optimization recommendations
 * 
 * @author Fatima Sanusi
 * @notice Use this contract to estimate gas costs for DID operations
 */
contract GasEstimation {
    using SafeMath for uint256;
    
    // ===== GAS ESTIMATION STRUCTURES =====
    
    /// @notice Gas estimation data for specific operations
    struct GasEstimate {
        uint256 baseGas;              // Base gas cost
        uint256 variableGas;          // Variable gas component
        uint256 totalGas;             // Total estimated gas
        uint256 timestamp;            // Estimation timestamp
        uint256 networkGasPrice;      // Current network gas price
        uint256 estimatedCost;        // Estimated cost in wei
    }
    
    /// @notice Historical gas usage data
    struct GasHistory {
        uint256 operationCount;       // Number of operations performed
        uint256 totalGasUsed;         // Total gas used historically
        uint256 averageGas;           // Average gas per operation
        uint256 minGas;               // Minimum gas used
        uint256 maxGas;               // Maximum gas used
        uint256 lastUpdated;          // Last update timestamp
    }
    
    /// @notice Batch operation gas estimation
    struct BatchGasEstimate {
        uint256 operationCount;       // Number of operations in batch
        uint256 individualGas;        // Gas per individual operation
        uint256 batchDiscount;        // Batch discount percentage (0-100)
        uint256 totalBatchGas;        // Total gas for batch
        uint256 savings;              // Gas saved from batching
    }
    
    // ===== OPERATION TYPES =====
    
    enum OperationType {
        DID_CREATE,
        DID_UPDATE,
        DID_TRANSFER,
        DID_DELETE,
        CREDENTIAL_ISSUE,
        CREDENTIAL_REVOKE,
        CREDENTIAL_UPDATE,
        GOVERNANCE_PROPOSE,
        GOVERNANCE_VOTE,
        RECOVERY_INITIATE,
        RECOVERY_EXECUTE,
        BATCH_OPERATION,
        PROXY_UPGRADE,
        ACCESS_CONTROL
    }
    
    // ===== STORAGE =====
    
    /// @notice Gas estimates for each operation type
    mapping(OperationType => GasEstimate) public gasEstimates;
    
    /// @notice Historical gas data for each operation type
    mapping(OperationType => GasHistory) public gasHistory;
    
    /// @notice Network gas price history
    uint256[] public gasPriceHistory;
    
    /// @notice Timestamps for gas price history
    uint256[] public gasPriceTimestamps;
    
    /// @notice Maximum history entries to store
    uint256 public constant MAX_HISTORY_ENTRIES = 1000;
    
    // ===== BASE GAS COSTS (in wei) =====
    
    uint256 public constant BASE_DID_CREATE = 85000;
    uint256 public constant BASE_DID_UPDATE = 45000;
    uint256 public constant BASE_DID_TRANSFER = 35000;
    uint256 public constant BASE_DID_DELETE = 25000;
    uint256 public constant BASE_CREDENTIAL_ISSUE = 95000;
    uint256 public constant BASE_CREDENTIAL_REVOKE = 30000;
    uint256 public constant BASE_CREDENTIAL_UPDATE = 55000;
    uint256 public constant BASE_GOVERNANCE_PROPOSE = 120000;
    uint256 public constant BASE_GOVERNANCE_VOTE = 65000;
    uint256 public constant BASE_RECOVERY_INITIATE = 150000;
    uint256 public constant BASE_RECOVERY_EXECUTE = 180000;
    uint256 public constant BASE_PROXY_UPGRADE = 200000;
    uint256 public constant BASE_ACCESS_CONTROL = 40000;
    
    // ===== BATCH DISCOUNTS =====
    
    uint256 public constant BATCH_SMALL_DISCOUNT = 5;    // 5% for 2-5 items
    uint256 public constant BATCH_MEDIUM_DISCOUNT = 10;  // 10% for 6-20 items
    uint256 public constant BATCH_LARGE_DISCOUNT = 15;    // 15% for 21-50 items
    uint256 public constant BATCH_XLARGE_DISCOUNT = 20;  // 20% for 51+ items
    
    // ===== EVENTS =====
    
    event GasEstimateUpdated(
        OperationType indexed operation,
        uint256 baseGas,
        uint256 variableGas,
        uint256 totalGas,
        uint256 timestamp
    );
    
    event GasHistoryRecorded(
        OperationType indexed operation,
        uint256 actualGasUsed,
        uint256 newAverage
    );
    
    event BatchGasEstimated(
        uint256 operationCount,
        uint256 totalGas,
        uint256 savings,
        uint256 discount
    );
    
    // ===== PUBLIC FUNCTIONS =====
    
    /**
     * @dev Estimates gas cost for DID creation
     * @param owner Owner address
     * @param publicKey Public key bytes
     * @param serviceEndpoints Number of service endpoints
     * @return estimate Gas estimation details
     */
    function estimateDIDCreation(
        address owner,
        bytes calldata publicKey,
        uint256 serviceEndpoints
    ) external view returns (GasEstimate memory estimate) {
        uint256 baseCost = BASE_DID_CREATE;
        uint256 variableCost = calculateVariableCost(
            publicKey.length,
            serviceEndpoints * 1000, // 1000 gas per service endpoint
            owner != address(0) ? 0 : 5000 // Additional cost if owner is zero
        );
        
        estimate = createGasEstimate(OperationType.DID_CREATE, baseCost, variableCost);
    }
    
    /**
     * @dev Estimates gas cost for credential issuance
     * @param issuer Issuer address
     * @param subject Subject address
     * @param credentialDataLength Length of credential data
     * @return estimate Gas estimation details
     */
    function estimateCredentialIssuance(
        address issuer,
        address subject,
        uint256 credentialDataLength
    ) external view returns (GasEstimate memory estimate) {
        uint256 baseCost = BASE_CREDENTIAL_ISSUE;
        uint256 variableCost = calculateVariableCost(
            credentialDataLength * 10, // 10 gas per byte of credential data
            issuer != address(0) ? 0 : 3000,
            subject != address(0) ? 0 : 3000
        );
        
        estimate = createGasEstimate(OperationType.CREDENTIAL_ISSUE, baseCost, variableCost);
    }
    
    /**
     * @dev Estimates gas cost for batch operations
     * @param operationType Type of operation in batch
     * @param operationCount Number of operations
     * @param dataComplexity Average complexity factor (1-10)
     * @return estimate Batch gas estimation details
     */
    function estimateBatchOperation(
        OperationType operationType,
        uint256 operationCount,
        uint256 dataComplexity
    ) external view returns (BatchGasEstimate memory estimate) {
        require(operationCount > 0, "Batch must have at least one operation");
        require(dataComplexity >= 1 && dataComplexity <= 10, "Invalid complexity");
        
        uint256 individualGas = getBaseGasCost(operationType) * dataComplexity / 5;
        uint256 discount = getBatchDiscount(operationCount);
        
        estimate.operationCount = operationCount;
        estimate.individualGas = individualGas;
        estimate.batchDiscount = discount;
        estimate.totalBatchGas = individualGas * operationCount * (100 - discount) / 100;
        estimate.savings = individualGas * operationCount * discount / 100;
    }
    
    /**
     * @dev Estimates gas cost for governance operations
     * @param isProposal True for proposal, false for vote
     * @param proposalDataLength Length of proposal data
     * @param votingPower Voting power amount (for votes)
     * @return estimate Gas estimation details
     */
    function estimateGovernanceOperation(
        bool isProposal,
        uint256 proposalDataLength,
        uint256 votingPower
    ) external view returns (GasEstimate memory estimate) {
        OperationType opType = isProposal ? OperationType.GOVERNANCE_PROPOSE : OperationType.GOVERNANCE_VOTE;
        uint256 baseCost = isProposal ? BASE_GOVERNANCE_PROPOSE : BASE_GOVERNANCE_VOTE;
        
        uint256 variableCost = calculateVariableCost(
            proposalDataLength * 5, // 5 gas per byte of proposal data
            votingPower > 0 ? votingPower / 1000000 : 0, // 1 gas per 1M voting power
            0
        );
        
        estimate = createGasEstimate(opType, baseCost, variableCost);
    }
    
    /**
     * @dev Estimates gas cost for recovery operations
     * @param isInitiate True for initiation, false for execution
     * @param recoveryDataLength Length of recovery data
     * @param signatureCount Number of signatures required
     * @return estimate Gas estimation details
     */
    function estimateRecoveryOperation(
        bool isInitiate,
        uint256 recoveryDataLength,
        uint256 signatureCount
    ) external view returns (GasEstimate memory estimate) {
        OperationType opType = isInitiate ? OperationType.RECOVERY_INITIATE : OperationType.RECOVERY_EXECUTE;
        uint256 baseCost = isInitiate ? BASE_RECOVERY_INITIATE : BASE_RECOVERY_EXECUTE;
        
        uint256 variableCost = calculateVariableCost(
            recoveryDataLength * 8, // 8 gas per byte of recovery data
            signatureCount * 2000,  // 2000 gas per signature
            0
        );
        
        estimate = createGasEstimate(opType, baseCost, variableCost);
    }
    
    /**
     * @dev Estimates gas cost for proxy upgrade
     * @param newImplementationLength Length of new implementation code
     * @param stateDataSize Size of state data to migrate
     * @return estimate Gas estimation details
     */
    function estimateProxyUpgrade(
        uint256 newImplementationLength,
        uint256 stateDataSize
    ) external view returns (GasEstimate memory estimate) {
        uint256 baseCost = BASE_PROXY_UPGRADE;
        
        uint256 variableCost = calculateVariableCost(
            newImplementationLength * 2, // 2 gas per byte of implementation
            stateDataSize * 50,          // 50 gas per byte of state data
            0
        );
        
        estimate = createGasEstimate(OperationType.PROXY_UPGRADE, baseCost, variableCost);
    }
    
    /**
     * @dev Records actual gas usage for historical tracking
     * @param operation Type of operation performed
     * @param actualGasUsed Actual gas consumed
     */
    function recordGasUsage(OperationType operation, uint256 actualGasUsed) external {
        GasHistory storage history = gasHistory[operation];
        
        if (history.operationCount == 0) {
            // First time recording
            history.minGas = actualGasUsed;
            history.maxGas = actualGasUsed;
            history.averageGas = actualGasUsed;
        } else {
            // Update min/max/average
            if (actualGasUsed < history.minGas) {
                history.minGas = actualGasUsed;
            }
            if (actualGasUsed > history.maxGas) {
                history.maxGas = actualGasUsed;
            }
            
            history.totalGasUsed = history.totalGasUsed.add(actualGasUsed);
            history.averageGas = history.totalGasUsed.div(history.operationCount + 1);
        }
        
        history.operationCount++;
        history.lastUpdated = block.timestamp;
        
        emit GasHistoryRecorded(operation, actualGasUsed, history.averageGas);
    }
    
    /**
     * @dev Updates network gas price history
     * @param gasPrice Current network gas price
     */
    function updateGasPriceHistory(uint256 gasPrice) external {
        gasPriceHistory.push(gasPrice);
        gasPriceTimestamps.push(block.timestamp);
        
        // Keep history size manageable
        if (gasPriceHistory.length > MAX_HISTORY_ENTRIES) {
            // Remove oldest entry
            for (uint256 i = 0; i < gasPriceHistory.length - 1; i++) {
                gasPriceHistory[i] = gasPriceHistory[i + 1];
                gasPriceTimestamps[i] = gasPriceTimestamps[i + 1];
            }
            gasPriceHistory.pop();
            gasPriceTimestamps.pop();
        }
    }
    
    /**
     * @dev Gets optimized gas estimate based on historical data
     * @param operation Type of operation
     * @param useHistoricalAverage Whether to use historical average
     * @return estimate Optimized gas estimation
     */
    function getOptimizedEstimate(
        OperationType operation,
        bool useHistoricalAverage
    ) external view returns (GasEstimate memory estimate) {
        if (useHistoricalAverage) {
            GasHistory storage history = gasHistory[operation];
            if (history.operationCount > 0) {
                estimate.baseGas = history.averageGas;
                estimate.variableGas = 0;
                estimate.totalGas = history.averageGas;
                estimate.timestamp = block.timestamp;
                estimate.networkGasPrice = tx.gasprice;
                estimate.estimatedCost = history.averageGas * tx.gasprice;
                return estimate;
            }
        }
        
        // Fall back to base estimate
        uint256 baseCost = getBaseGasCost(operation);
        estimate = createGasEstimate(operation, baseCost, 0);
    }
    
    // ===== INTERNAL FUNCTIONS =====
    
    /**
     * @dev Creates a gas estimate structure
     * @param operation Type of operation
     * @param baseCost Base gas cost
     * @param variableCost Variable gas cost
     * @return estimate Complete gas estimate
     */
    function createGasEstimate(
        OperationType operation,
        uint256 baseCost,
        uint256 variableCost
    ) internal view returns (GasEstimate memory estimate) {
        estimate.baseGas = baseCost;
        estimate.variableGas = variableCost;
        estimate.totalGas = baseCost + variableCost;
        estimate.timestamp = block.timestamp;
        estimate.networkGasPrice = tx.gasprice;
        estimate.estimatedCost = estimate.totalGas * tx.gasprice;
    }
    
    /**
     * @dev Calculates variable cost based on multiple factors
     * @param dataCost Cost related to data size
     * @param validationCost Cost related to validation
     * @param storageCost Cost related to storage operations
     * @return totalVariableCost Total variable cost
     */
    function calculateVariableCost(
        uint256 dataCost,
        uint256 validationCost,
        uint256 storageCost
    ) internal pure returns (uint256 totalVariableCost) {
        return dataCost + validationCost + storageCost;
    }
    
    /**
     * @dev Gets base gas cost for operation type
     * @param operation Type of operation
     * @return baseCost Base gas cost
     */
    function getBaseGasCost(OperationType operation) internal pure returns (uint256 baseCost) {
        if (operation == OperationType.DID_CREATE) return BASE_DID_CREATE;
        if (operation == OperationType.DID_UPDATE) return BASE_DID_UPDATE;
        if (operation == OperationType.DID_TRANSFER) return BASE_DID_TRANSFER;
        if (operation == OperationType.DID_DELETE) return BASE_DID_DELETE;
        if (operation == OperationType.CREDENTIAL_ISSUE) return BASE_CREDENTIAL_ISSUE;
        if (operation == OperationType.CREDENTIAL_REVOKE) return BASE_CREDENTIAL_REVOKE;
        if (operation == OperationType.CREDENTIAL_UPDATE) return BASE_CREDENTIAL_UPDATE;
        if (operation == OperationType.GOVERNANCE_PROPOSE) return BASE_GOVERNANCE_PROPOSE;
        if (operation == OperationType.GOVERNANCE_VOTE) return BASE_GOVERNANCE_VOTE;
        if (operation == OperationType.RECOVERY_INITIATE) return BASE_RECOVERY_INITIATE;
        if (operation == OperationType.RECOVERY_EXECUTE) return BASE_RECOVERY_EXECUTE;
        if (operation == OperationType.PROXY_UPGRADE) return BASE_PROXY_UPGRADE;
        if (operation == OperationType.ACCESS_CONTROL) return BASE_ACCESS_CONTROL;
        return 50000; // Default for unknown operations
    }
    
    /**
     * @dev Gets batch discount based on operation count
     * @param operationCount Number of operations
     * @return discount Discount percentage
     */
    function getBatchDiscount(uint256 operationCount) internal pure returns (uint256 discount) {
        if (operationCount >= 51) return BATCH_XLARGE_DISCOUNT;
        if (operationCount >= 21) return BATCH_LARGE_DISCOUNT;
        if (operationCount >= 6) return BATCH_MEDIUM_DISCOUNT;
        if (operationCount >= 2) return BATCH_SMALL_DISCOUNT;
        return 0;
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @dev Gets gas history for operation type
     * @param operation Type of operation
     * @return history Historical gas data
     */
    function getGasHistory(OperationType operation) external view returns (GasHistory memory history) {
        return gasHistory[operation];
    }
    
    /**
     * @dev Gets average network gas price from history
     * @param sampleSize Number of samples to average
     * @return averageGasPrice Average gas price
     */
    function getAverageGasPrice(uint256 sampleSize) external view returns (uint256 averageGasPrice) {
        if (gasPriceHistory.length == 0) return 0;
        
        uint256 samples = sampleSize > gasPriceHistory.length ? gasPriceHistory.length : sampleSize;
        if (samples == 0) return 0;
        
        uint256 total = 0;
        uint256 startIndex = gasPriceHistory.length > samples ? gasPriceHistory.length - samples : 0;
        
        for (uint256 i = startIndex; i < gasPriceHistory.length; i++) {
            total += gasPriceHistory[i];
        }
        
        return total / samples;
    }
    
    /**
     * @dev Gets gas optimization recommendations
     * @param operation Type of operation
     * @return recommendations Array of optimization recommendations
     */
    function getOptimizationRecommendations(OperationType operation) external view returns (string[] memory recommendations) {
        GasHistory storage history = gasHistory[operation];
        recommendations = new string[](3);
        
        if (history.operationCount == 0) {
            recommendations[0] = "No historical data available. Use batch operations when possible.";
            recommendations[1] = "Minimize data size in transactions.";
            recommendations[2] = "Consider using gas optimization features.";
        } else {
            uint256 variance = history.maxGas > history.minGas ? (history.maxGas - history.minGas) * 100 / history.averageGas : 0;
            
            if (variance > 30) {
                recommendations[0] = "High variance detected. Consider batching similar operations.";
            } else {
                recommendations[0] = "Consistent gas usage. Current patterns are efficient.";
            }
            
            if (history.averageGas > getBaseGasCost(operation) * 2) {
                recommendations[1] = "High average gas usage. Review data size and complexity.";
            } else {
                recommendations[1] = "Gas usage is within expected range.";
            }
            
            recommendations[2] = "Use batch operations for 5%+ gas savings.";
        }
    }
}
