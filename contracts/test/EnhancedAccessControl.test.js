const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EnhancedAccessControl", function () {
    let enhancedAccessControl;
    let owner, admin, governor, issuer, validator, user, auditor, unauthorized;
    
    // Role constants
    const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ADMIN"));
    const ROLE_GOVERNOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_GOVERNOR"));
    const ROLE_ISSUER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_ISSUER"));
    const ROLE_VALIDATOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_VALIDATOR"));
    const ROLE_USER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_USER"));
    const ROLE_AUDITOR = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ROLE_AUDITOR"));

    beforeEach(async function () {
        [owner, admin, governor, issuer, validator, user, auditor, unauthorized] = await ethers.getSigners();
        
        const EnhancedAccessControl = await ethers.getContractFactory("EnhancedAccessControl");
        enhancedAccessControl = await EnhancedAccessControl.deploy();
        await enhancedAccessControl.deployed();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await enhancedAccessControl.hasRole(ROLE_ADMIN, owner.address)).to.be.true;
            expect(await enhancedAccessControl.hasRole(await enhancedAccessControl.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
        });

        it("Should initialize role hierarchy correctly", async function () {
            const adminHierarchy = await enhancedAccessControl.roleHierarchy(ROLE_ADMIN);
            expect(adminHierarchy.level).to.equal(0);
            expect(adminHierarchy.canDelegate).to.be.true;
            expect(adminHierarchy.maxDelegationLevel).to.equal(5);

            const governorHierarchy = await enhancedAccessControl.roleHierarchy(ROLE_GOVERNOR);
            expect(governorHierarchy.level).to.equal(1);
            expect(governorHierarchy.parentRole).to.equal(ROLE_ADMIN);
        });

        it("Should have all active roles initialized", async function () {
            const activeRoles = await enhancedAccessControl.getActiveRoles();
            expect(activeRoles.length).to.equal(6);
            expect(activeRoles).to.include(ROLE_ADMIN);
            expect(activeRoles).to.include(ROLE_GOVERNOR);
            expect(activeRoles).to.include(ROLE_ISSUER);
            expect(activeRoles).to.include(ROLE_VALIDATOR);
            expect(activeRoles).to.include(ROLE_USER);
            expect(activeRoles).to.include(ROLE_AUDITOR);
        });
    });

    describe("Role Management", function () {
        it("Should allow admin to grant roles", async function () {
            await enhancedAccessControl.grantRole(ROLE_GOVERNOR, governor.address);
            expect(await enhancedAccessControl.hasRole(ROLE_GOVERNOR, governor.address)).to.be.true;
        });

        it("Should prevent non-admin from granting roles", async function () {
            await expect(
                enhancedAccessControl.connect(unauthorized).grantRole(ROLE_GOVERNOR, unauthorized.address)
            ).to.be.revertedWith("AccessControl: account");
        });

        it("Should allow admin to revoke roles", async function () {
            await enhancedAccessControl.grantRole(ROLE_GOVERNOR, governor.address);
            await enhancedAccessControl.revokeRole(ROLE_GOVERNOR, governor.address);
            expect(await enhancedAccessControl.hasRole(ROLE_GOVERNOR, governor.address)).to.be.false;
        });
    });

    describe("Permission Management", function () {
        beforeEach(async function () {
            // Setup roles for testing
            await enhancedAccessControl.grantRole(ROLE_GOVERNOR, governor.address);
            await enhancedAccessControl.grantRole(ROLE_ISSUER, issuer.address);
            await enhancedAccessControl.grantRole(ROLE_VALIDATOR, validator.address);
            await enhancedAccessControl.grantRole(ROLE_USER, user.address);
            await enhancedAccessControl.grantRole(ROLE_AUDITOR, auditor.address);
        });

        it("Should allow admin to grant permissions", async function () {
            const resourceId = 0; // DID
            const operationId = 0; // CREATE
            const expiresAt = 0; // Never expires
            
            await enhancedAccessControl.grantPermission(
                ROLE_GOVERNOR,
                resourceId,
                operationId,
                expiresAt,
                ""
            );

            const permission = await enhancedAccessControl.rolePermissions(ROLE_GOVERNOR, resourceId, operationId);
            expect(permission.granted).to.be.true;
            expect(permission.expiresAt).to.equal(0);
        });

        it("Should allow admin to revoke permissions", async function () {
            const resourceId = 0; // DID
            const operationId = 0; // CREATE
            
            // Grant first
            await enhancedAccessControl.grantPermission(ROLE_GOVERNOR, resourceId, operationId, 0, "");
            
            // Then revoke
            await enhancedAccessControl.revokePermission(ROLE_GOVERNOR, resourceId, operationId);
            
            const permission = await enhancedAccessControl.rolePermissions(ROLE_GOVERNOR, resourceId, operationId);
            expect(permission.granted).to.be.false;
        });

        it("Should prevent non-admin from granting permissions", async function () {
            await expect(
                enhancedAccessControl.connect(unauthorized).grantPermission(ROLE_GOVERNOR, 0, 0, 0, "")
            ).to.be.revertedWith("AccessControl: admin access required");
        });

        it("Should handle time-based permissions correctly", async function () {
            const resourceId = 0; // DID
            const operationId = 0; // CREATE
            const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            
            await enhancedAccessControl.grantPermission(ROLE_GOVERNOR, resourceId, operationId, expiresAt, "");
            
            // Should be valid now
            expect(await enhancedAccessControl.checkPermission(governor.address, resourceId, operationId)).to.be.true;
        });
    });

    describe("User-Specific Permissions", function () {
        it("Should allow admin to set user-specific permissions", async function () {
            const resourceId = 0; // DID
            const operationId = 0; // CREATE
            
            await enhancedAccessControl.setUserPermission(unauthorized.address, resourceId, operationId, true);
            
            expect(await enhancedAccessControl.checkPermission(unauthorized.address, resourceId, operationId)).to.be.true;
        });

        it("Should allow admin to deny user-specific permissions", async function () {
            const resourceId = 0; // DID
            const operationId = 0; // CREATE
            
            await enhancedAccessControl.setUserPermission(unauthorized.address, resourceId, operationId, false);
            
            expect(await enhancedAccessControl.checkPermission(unauthorized.address, resourceId, operationId)).to.be.false;
        });

        it("Should add user to authorized users when permission is granted", async function () {
            await enhancedAccessControl.setUserPermission(unauthorized.address, 0, 0, true);
            
            const authorizedUsers = await enhancedAccessControl.getAuthorizedUsers();
            expect(authorizedUsers).to.include(unauthorized.address);
        });
    });

    describe("Emergency Access", function () {
        it("Should allow admin to grant emergency access", async function () {
            await enhancedAccessControl.grantEmergencyAccess(unauthorized.address, "Test emergency access");
            
            expect(await enhancedAccessControl.emergencyAccess(unauthorized.address)).to.be.true;
            expect(await enhancedAccessControl.checkPermission(unauthorized.address, 0, 0)).to.be.true;
        });

        it("Should allow admin to revoke emergency access", async function () {
            await enhancedAccessControl.grantEmergencyAccess(unauthorized.address, "Test");
            await enhancedAccessControl.revokeEmergencyAccess(unauthorized.address);
            
            expect(await enhancedAccessControl.emergencyAccess(unauthorized.address)).to.be.false;
        });

        it("Should prevent duplicate emergency access grants", async function () {
            await enhancedAccessControl.grantEmergencyAccess(unauthorized.address, "Test");
            
            await expect(
                enhancedAccessControl.grantEmergencyAccess(unauthorized.address, "Test 2")
            ).to.be.revertedWith("AccessControl: emergency access already granted");
        });
    });

    describe("Permission Checking", function () {
        beforeEach(async function () {
            // Setup roles
            await enhancedAccessControl.grantRole(ROLE_GOVERNOR, governor.address);
            await enhancedAccessControl.grantRole(ROLE_ISSUER, issuer.address);
            await enhancedAccessControl.grantRole(ROLE_VALIDATOR, validator.address);
            await enhancedAccessControl.grantRole(ROLE_USER, user.address);
            await enhancedAccessControl.grantRole(ROLE_AUDITOR, auditor.address);
        });

        it("Should correctly check admin permissions", async function () {
            // Admin should have all permissions
            for (let resource = 0; resource <= 4; resource++) {
                for (let operation = 0; operation <= 7; operation++) {
                    expect(await enhancedAccessControl.checkPermission(owner.address, resource, operation)).to.be.true;
                }
            }
        });

        it("Should correctly check governor permissions", async function () {
            // Governor should have governance permissions
            expect(await enhancedAccessControl.checkPermission(governor.address, 2, 0)).to.be.true; // GOVERNANCE, CREATE
            expect(await enhancedAccessControl.checkPermission(governor.address, 2, 1)).to.be.true; // GOVERNANCE, READ
            expect(await enhancedAccessControl.checkPermission(governor.address, 2, 2)).to.be.true; // GOVERNANCE, UPDATE
            expect(await enhancedAccessControl.checkPermission(governor.address, 2, 4)).to.be.true; // GOVERNANCE, ADMIN
            
            // But not all DID operations
            expect(await enhancedAccessControl.checkPermission(governor.address, 0, 0)).to.be.false; // DID, CREATE
        });

        it("Should correctly check issuer permissions", async function () {
            // Issuer should have credential permissions
            expect(await enhancedAccessControl.checkPermission(issuer.address, 1, 0)).to.be.true; // CREDENTIAL, CREATE
            expect(await enhancedAccessControl.checkPermission(issuer.address, 1, 1)).to.be.true; // CREDENTIAL, READ
            expect(await enhancedAccessControl.checkPermission(issuer.address, 1, 2)).to.be.true; // CREDENTIAL, UPDATE
            expect(await enhancedAccessControl.checkPermission(issuer.address, 1, 3)).to.be.true; // CREDENTIAL, DELETE
            
            // But not governance operations
            expect(await enhancedAccessControl.checkPermission(issuer.address, 2, 4)).to.be.false; // GOVERNANCE, ADMIN
        });

        it("Should correctly check validator permissions", async function () {
            // Validator should have validation permissions
            expect(await enhancedAccessControl.checkPermission(validator.address, 0, 5)).to.be.true; // DID, VALIDATE
            expect(await enhancedAccessControl.checkPermission(validator.address, 1, 5)).to.be.true; // CREDENTIAL, VALIDATE
            
            // But not create operations
            expect(await enhancedAccessControl.checkPermission(validator.address, 0, 0)).to.be.false; // DID, CREATE
        });

        it("Should correctly check auditor permissions", async function () {
            // Auditor should have read-only permissions
            expect(await enhancedAccessControl.checkPermission(auditor.address, 0, 1)).to.be.true; // DID, READ
            expect(await enhancedAccessControl.checkPermission(auditor.address, 1, 1)).to.be.true; // CREDENTIAL, READ
            expect(await enhancedAccessControl.checkPermission(auditor.address, 2, 1)).to.be.true; // GOVERNANCE, READ
            expect(await enhancedAccessControl.checkPermission(auditor.address, 3, 1)).to.be.true; // SYSTEM, READ
            
            // But not create operations
            expect(await enhancedAccessControl.checkPermission(auditor.address, 0, 0)).to.be.false; // DID, CREATE
        });

        it("Should return false for unauthorized users", async function () {
            expect(await enhancedAccessControl.checkPermission(unauthorized.address, 0, 0)).to.be.false;
        });
    });

    describe("Role Hierarchy", function () {
        it("Should allow admin to update role hierarchy", async function () {
            await enhancedAccessControl.updateRoleHierarchy(
                ROLE_ISSUER,
                ROLE_ADMIN,
                1,
                true,
                4
            );

            const hierarchy = await enhancedAccessControl.roleHierarchy(ROLE_ISSUER);
            expect(hierarchy.parentRole).to.equal(ROLE_ADMIN);
            expect(hierarchy.level).to.equal(1);
            expect(hierarchy.canDelegate).to.be.true;
            expect(hierarchy.maxDelegationLevel).to.equal(4);
        });

        it("Should prevent non-admin from updating role hierarchy", async function () {
            await expect(
                enhancedAccessControl.connect(unauthorized).updateRoleHierarchy(ROLE_ISSUER, ROLE_ADMIN, 1, true, 4)
            ).to.be.revertedWith("AccessControl: admin access required");
        });
    });

    describe("Audit Trail", function () {
        it("Should log access requests", async function () {
            // This would be tested through the access log after operations
            // For now, we test the access log retrieval function
            const accessLog = await enhancedAccessControl.getAccessLog(0, 10);
            expect(Array.isArray(accessLog)).to.be.true;
        });

        it("Should only allow admin to access audit log", async function () {
            await expect(
                enhancedAccessControl.connect(unauthorized).getAccessLog(0, 10)
            ).to.be.revertedWith("AccessControl: admin access required");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle invalid expiration times", async function () {
            await expect(
                enhancedAccessControl.grantPermission(ROLE_GOVERNOR, 0, 0, 1, "") // Past time
            ).to.be.revertedWith("AccessControl: invalid expiration");
        });

        it("Should handle inactive roles", async function () {
            const fakeRole = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("FAKE_ROLE"));
            
            await expect(
                enhancedAccessControl.grantPermission(fakeRole, 0, 0, 0, "")
            ).to.be.revertedWith("AccessControl: role not active");
        });

        it("Should handle zero address for user permissions", async function () {
            await expect(
                enhancedAccessControl.setUserPermission(ethers.constants.AddressZero, 0, 0, true)
            ).to.be.revertedWith("AccessControl: invalid user address");
        });

        it("Should handle zero address for emergency access", async function () {
            await expect(
                enhancedAccessControl.grantEmergencyAccess(ethers.constants.AddressZero, "Test")
            ).to.be.revertedWith("AccessControl: invalid user address");
        });
    });

    describe("Gas Optimization", function () {
        it("Should have reasonable gas costs for permission checks", async function () {
            const tx = await enhancedAccessControl.checkPermission(owner.address, 0, 0);
            const receipt = await tx.wait();
            
            // Gas cost should be reasonable (less than 50000 for a simple check)
            expect(receipt.gasUsed.toNumber()).to.be.lessThan(50000);
        });

        it("Should have reasonable gas costs for permission grants", async function () {
            const tx = await enhancedAccessControl.grantPermission(ROLE_GOVERNOR, 0, 0, 0, "");
            const receipt = await tx.wait();
            
            // Gas cost should be reasonable (less than 100000 for permission grant)
            expect(receipt.gasUsed.toNumber()).to.be.lessThan(100000);
        });
    });

    describe("Integration Tests", function () {
        it("Should work with complex permission scenarios", async function () {
            // Setup roles
            await enhancedAccessControl.grantRole(ROLE_GOVERNOR, governor.address);
            await enhancedAccessControl.grantRole(ROLE_ISSUER, issuer.address);
            
            // Grant additional permission to governor
            await enhancedAccessControl.grantPermission(ROLE_GOVERNOR, 0, 0, 0, ""); // DID CREATE
            
            // Governor should now have DID CREATE permission
            expect(await enhancedAccessControl.checkPermission(governor.address, 0, 0)).to.be.true;
            
            // Set user-specific override
            await enhancedAccessControl.setUserPermission(unauthorized.address, 0, 0, true);
            
            // Unauthorized user should now have permission
            expect(await enhancedAccessControl.checkPermission(unauthorized.address, 0, 0)).to.be.true;
            
            // Revoke user-specific permission
            await enhancedAccessControl.setUserPermission(unauthorized.address, 0, 0, false);
            
            // Should now be false again
            expect(await enhancedAccessControl.checkPermission(unauthorized.address, 0, 0)).to.be.false;
        });
    });
});
