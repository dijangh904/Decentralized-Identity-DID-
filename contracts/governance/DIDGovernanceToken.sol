// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DIDGovernanceToken
 * @dev ERC20 token with voting capabilities for DID governance
 * Used for voting on contract upgrades and protocol changes
 */
contract DIDGovernanceToken is ERC20, ERC20Votes, Ownable {
    
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens
    uint256 public constant INITIAL_SUPPLY = 100000000 * 10**18; // 100 million tokens
    
    mapping(address => bool) public isMinter;
    mapping(address => bool) public isBurner;
    
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    event BurnerAdded(address indexed burner);
    event BurnerRemoved(address indexed burner);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    modifier onlyMinter() {
        require(isMinter[msg.sender], "Not authorized to mint");
        _;
    }
    
    modifier onlyBurner() {
        require(isBurner[msg.sender], "Not authorized to burn");
        _;
    }
    
    constructor() ERC20("DID Governance Token", "DIDGT") {
        _mint(msg.sender, INITIAL_SUPPLY);
        isMinter[msg.sender] = true;
        isBurner[msg.sender] = true;
    }
    
    /**
     * @dev Mint new tokens (only authorized minters)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= 1000000 * 10**18, "Amount exceeds single mint limit");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Burn tokens (only authorized burners)
     */
    function burn(address from, uint256 amount) external onlyBurner {
        require(from != address(0), "Cannot burn from zero address");
        require(amount > 0, "Amount must be greater than zero");
        require(amount <= balanceOf(from), "Insufficient balance");
        require(amount <= 1000000 * 10**18, "Amount exceeds single burn limit");
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Add a new minter
     */
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "Minter cannot be zero address");
        require(minter != msg.sender, "Cannot grant minter role to self");
        require(!isMinter[minter], "Already a minter");
        isMinter[minter] = true;
        emit MinterAdded(minter);
    }
    
    /**
     * @dev Remove a minter
     */
    function removeMinter(address minter) external onlyOwner {
        require(minter != address(0), "Minter cannot be zero address");
        require(isMinter[minter], "Not a minter");
        isMinter[minter] = false;
        emit MinterRemoved(minter);
    }
    
    /**
     * @dev Add a new burner
     */
    function addBurner(address burner) external onlyOwner {
        require(burner != address(0), "Burner cannot be zero address");
        require(burner != msg.sender, "Cannot grant burner role to self");
        require(!isBurner[burner], "Already a burner");
        isBurner[burner] = true;
        emit BurnerAdded(burner);
    }
    
    /**
     * @dev Remove a burner
     */
    function removeBurner(address burner) external onlyOwner {
        require(burner != address(0), "Burner cannot be zero address");
        require(isBurner[burner], "Not a burner");
        isBurner[burner] = false;
        emit BurnerRemoved(burner);
    }
    
    // The following functions are overrides required by Solidity.
    
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }
}
