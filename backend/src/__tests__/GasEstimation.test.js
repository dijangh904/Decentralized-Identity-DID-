/**
 * @title GasEstimation Tests
 * @dev Comprehensive tests for gas estimation functionality
 */

const { ethers } = require('ethers');
const GasEstimation = require('../utils/GasEstimation');

describe('GasEstimation', () => {
    let gasEstimation;
    let mockContract;

    beforeEach(() => {
        // Mock contract instance
        mockContract = {
            estimateGas: {
                createDID: jest.fn().mockResolvedValue(ethers.BigNumber.from(85000)),
                updateDID: jest.fn().mockResolvedValue(ethers.BigNumber.from(45000)),
                issueCredential: jest.fn().mockResolvedValue(ethers.BigNumber.from(95000)),
                revokeCredential: jest.fn().mockResolvedValue(ethers.BigNumber.from(30000))
            }
        };

        gasEstimation = new GasEstimation(mockContract);
    });

    describe('DID Operations Gas Estimation', () => {
        test('should estimate DID creation gas cost', async () => {
            const owner = '0x1234567890123456789012345678901234567890';
            const publicKey = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
            const serviceEndpoints = 3;

            const estimate = await gasEstimation.estimateDIDCreation(owner, publicKey, serviceEndpoints);

            expect(estimate.baseGas).toBe(85000);
            expect(estimate.variableGas).toBeGreaterThan(0);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
            expect(estimate.networkGasPrice).toBeDefined();
            expect(estimate.estimatedCost).toBeGreaterThan(0);
        });

        test('should estimate DID update gas cost', async () => {
            const did = 'did:stellar:1234567890';
            const changes = { publicKey: 'newPublicKey' };

            const estimate = await gasEstimation.estimateDIDUpdate(did, changes);

            expect(estimate.baseGas).toBe(45000);
            expect(estimate.variableGas).toBeGreaterThan(0);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });

        test('should estimate DID transfer gas cost', async () => {
            const did = 'did:stellar:1234567890';
            const newOwner = '0x0987654321098765432109876543210987654321';

            const estimate = await gasEstimation.estimateDIDTransfer(did, newOwner);

            expect(estimate.baseGas).toBe(35000);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });
    });

    describe('Credential Operations Gas Estimation', () => {
        test('should estimate credential issuance gas cost', async () => {
            const issuer = '0x1234567890123456789012345678901234567890';
            const subject = '0x0987654321098765432109876543210987654321';
            const credentialDataLength = 1000;

            const estimate = await gasEstimation.estimateCredentialIssuance(issuer, subject, credentialDataLength);

            expect(estimate.baseGas).toBe(95000);
            expect(estimate.variableGas).toBeGreaterThan(0);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });

        test('should estimate credential revocation gas cost', async () => {
            const credentialId = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

            const estimate = await gasEstimation.estimateCredentialRevocation(credentialId);

            expect(estimate.baseGas).toBe(30000);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });
    });

    describe('Batch Operations Gas Estimation', () => {
        test('should estimate batch operation gas cost with discount', async () => {
            const operationType = 'DID_CREATE';
            const operationCount = 10;
            const dataComplexity = 5;

            const estimate = await gasEstimation.estimateBatchOperation(operationType, operationCount, dataComplexity);

            expect(estimate.operationCount).toBe(10);
            expect(estimate.individualGas).toBeGreaterThan(0);
            expect(estimate.batchDiscount).toBeGreaterThan(0);
            expect(estimate.totalBatchGas).toBeLessThan(estimate.individualGas * operationCount);
            expect(estimate.savings).toBeGreaterThan(0);
        });

        test('should apply correct discount based on batch size', async () => {
            const smallBatch = await gasEstimation.estimateBatchOperation('DID_CREATE', 3, 5);
            const mediumBatch = await gasEstimation.estimateBatchOperation('DID_CREATE', 10, 5);
            const largeBatch = await gasEstimation.estimateBatchOperation('DID_CREATE', 30, 5);
            const xlargeBatch = await gasEstimation.estimateBatchOperation('DID_CREATE', 60, 5);

            expect(smallBatch.batchDiscount).toBe(5);
            expect(mediumBatch.batchDiscount).toBe(10);
            expect(largeBatch.batchDiscount).toBe(15);
            expect(xlargeBatch.batchDiscount).toBe(20);
        });
    });

    describe('Governance Operations Gas Estimation', () => {
        test('should estimate governance proposal gas cost', async () => {
            const proposalDataLength = 2000;
            const votingPower = 1000000;

            const estimate = await gasEstimation.estimateGovernanceOperation(true, proposalDataLength, votingPower);

            expect(estimate.baseGas).toBe(120000);
            expect(estimate.variableGas).toBeGreaterThan(0);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });

        test('should estimate governance vote gas cost', async () => {
            const proposalDataLength = 100;
            const votingPower = 500000;

            const estimate = await gasEstimation.estimateGovernanceOperation(false, proposalDataLength, votingPower);

            expect(estimate.baseGas).toBe(65000);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });
    });

    describe('Recovery Operations Gas Estimation', () => {
        test('should estimate recovery initiation gas cost', async () => {
            const recoveryDataLength = 1500;
            const signatureCount = 3;

            const estimate = await gasEstimation.estimateRecoveryOperation(true, recoveryDataLength, signatureCount);

            expect(estimate.baseGas).toBe(150000);
            expect(estimate.variableGas).toBeGreaterThan(0);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });

        test('should estimate recovery execution gas cost', async () => {
            const recoveryDataLength = 1000;
            const signatureCount = 5;

            const estimate = await gasEstimation.estimateRecoveryOperation(false, recoveryDataLength, signatureCount);

            expect(estimate.baseGas).toBe(180000);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });
    });

    describe('Proxy Upgrade Gas Estimation', () => {
        test('should estimate proxy upgrade gas cost', async () => {
            const newImplementationLength = 5000;
            const stateDataSize = 1000;

            const estimate = await gasEstimation.estimateProxyUpgrade(newImplementationLength, stateDataSize);

            expect(estimate.baseGas).toBe(200000);
            expect(estimate.variableGas).toBeGreaterThan(0);
            expect(estimate.totalGas).toBeGreaterThan(estimate.baseGas);
        });
    });

    describe('Gas History and Optimization', () => {
        test('should record gas usage and update history', async () => {
            const operationType = 'DID_CREATE';
            const actualGasUsed = 90000;

            await gasEstimation.recordGasUsage(operationType, actualGasUsed);

            const history = gasEstimation.getGasHistory(operationType);
            expect(history.operationCount).toBe(1);
            expect(history.totalGasUsed).toBe(actualGasUsed);
            expect(history.averageGas).toBe(actualGasUsed);
            expect(history.minGas).toBe(actualGasUsed);
            expect(history.maxGas).toBe(actualGasUsed);
        });

        test('should calculate average gas usage over multiple operations', async () => {
            const operationType = 'DID_CREATE';
            const gasUsages = [85000, 90000, 88000, 92000];

            for (const gasUsed of gasUsages) {
                await gasEstimation.recordGasUsage(operationType, gasUsed);
            }

            const history = gasEstimation.getGasHistory(operationType);
            expect(history.operationCount).toBe(4);
            expect(history.averageGas).toBe(88750); // (85000+90000+88000+92000)/4
            expect(history.minGas).toBe(85000);
            expect(history.maxGas).toBe(92000);
        });

        test('should provide optimized estimates based on historical data', async () => {
            const operationType = 'DID_CREATE';
            
            // Record some historical data
            await gasEstimation.recordGasUsage(operationType, 85000);
            await gasEstimation.recordGasUsage(operationType, 90000);
            await gasEstimation.recordGasUsage(operationType, 88000);

            const optimizedEstimate = gasEstimation.getOptimizedEstimate(operationType, true);

            expect(optimizedEstimate.baseGas).toBe(88750); // Average of recorded values
            expect(optimizedEstimate.variableGas).toBe(0);
            expect(optimizedEstimate.totalGas).toBe(88750);
        });
    });

    describe('Gas Price History', () => {
        test('should update and retrieve gas price history', async () => {
            const gasPrice1 = 20000000000; // 20 gwei
            const gasPrice2 = 25000000000; // 25 gwei

            await gasEstimation.updateGasPriceHistory(gasPrice1);
            await gasEstimation.updateGasPriceHistory(gasPrice2);

            const averageGasPrice = gasEstimation.getAverageGasPrice(2);
            expect(averageGasPrice).toBe(22500000000); // (20+25)/2 gwei
        });

        test('should limit history size to maximum entries', async () => {
            // Add more than maximum entries
            for (let i = 0; i < 1100; i++) {
                await gasEstimation.updateGasPriceHistory(20000000000 + i);
            }

            const averageGasPrice = gasEstimation.getAverageGasPrice(100);
            expect(averageGasPrice).toBeDefined();
        });
    });

    describe('Optimization Recommendations', () => {
        test('should provide optimization recommendations', async () => {
            const operationType = 'DID_CREATE';

            const recommendations = gasEstimation.getOptimizationRecommendations(operationType);

            expect(Array.isArray(recommendations)).toBe(true);
            expect(recommendations.length).toBe(3);
            recommendations.forEach(rec => {
                expect(typeof rec).toBe('string');
                expect(rec.length).toBeGreaterThan(0);
            });
        });

        test('should provide different recommendations based on variance', async () => {
            const operationType = 'DID_CREATE';

            // Record high variance data
            await gasEstimation.recordGasUsage(operationType, 50000);
            await gasEstimation.recordGasUsage(operationType, 150000);

            const recommendations = gasEstimation.getOptimizationRecommendations(operationType);
            expect(recommendations[0]).toContain('High variance');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid operation types gracefully', async () => {
            const invalidOperationType = 'INVALID_OPERATION';

            const estimate = gasEstimation.getOptimizedEstimate(invalidOperationType, true);
            expect(estimate.baseGas).toBe(50000); // Default value
        });

        test('should handle zero operation count in batch estimation', async () => {
            await expect(
                gasEstimation.estimateBatchOperation('DID_CREATE', 0, 5)
            ).rejects.toThrow('Batch must have at least one operation');
        });

        test('should handle invalid data complexity in batch estimation', async () => {
            await expect(
                gasEstimation.estimateBatchOperation('DID_CREATE', 10, 15)
            ).rejects.toThrow('Invalid complexity');
        });
    });
});
