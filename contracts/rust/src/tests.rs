use soroban_sdk::{Address, Bytes, Env, String};
use stellar_did_contract::{DIDContract, DIDContractClient};

#[test]
fn test_contract_initialization() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    // Pass constructor args during deployment
    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)  // Constructor arguments
    );
    let client = DIDContractClient::new(&env, &contract_id);

    let info = client.get_contract_info();
    assert_eq!(info.version, version);
    assert_eq!(info.network, network);
    assert_eq!(info.owner, owner);
}

#[test]
fn test_register_and_resolve_did() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    // Pass constructor args during deployment
    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Register DID
    let did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let public_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let service_endpoint = Some(String::from_str(&env, "https://example.com/did"));

    client.register_did(&did, &public_key, &service_endpoint, &owner);

    // Resolve DID
    let resolved = client.resolve_did(&did);
    
    assert_eq!(resolved.did, did);
    assert_eq!(resolved.owner, owner);
    assert_eq!(resolved.public_key, public_key);
    assert_eq!(resolved.service_endpoint, service_endpoint);
    assert!(resolved.active);
}

#[test]
fn test_update_did() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Register DID
    let did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let public_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    client.register_did(&did, &public_key, &None, &owner);

    // Update DID
    let new_public_key = Bytes::from_slice(&env, b"BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF");
    let new_endpoint = Some(String::from_str(&env, "https://newendpoint.com"));
    
    client.update_did(&did, &Some(new_public_key.clone()), &new_endpoint, &owner);

    // Verify update
    let resolved = client.resolve_did(&did);
    assert_eq!(resolved.public_key, new_public_key);
    assert_eq!(resolved.service_endpoint, new_endpoint);
    assert!(resolved.updated > resolved.created);
}

#[test]
fn test_unauthorized_did_update() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Register DID
    let did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let public_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    client.register_did(&did, &public_key, &None, &owner);

    // Try to update with unauthorized address
    let unauthorized = Address::generate(&env);
    let result = client.try_update_did(&did, &Some(public_key), &None, &unauthorized);
    
    assert!(result.is_err());
}

#[test]
fn test_issue_and_verify_credential() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Register issuer DID
    let issuer_did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let issuer_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    client.register_did(&issuer_did, &issuer_key, &None, &owner);

    // Register subject DID
    let subject_did = Bytes::from_slice(&env, b"did:stellar:BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF");
    let subject_key = Bytes::from_slice(&env, b"BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF");
    client.register_did(&subject_did, &subject_key, &None, &owner);

    // Issue credential
    let credential_type = String::from_str(&env, "UniversityDegree");
    let claims_hash = Bytes::from_slice(&env, b"hash_of_claims_data");
    let expires = Some(env.ledger().timestamp() + 86400);

    let credential_id = client.issue_credential(
        &issuer_did,
        &subject_did,
        &credential_type,
        &claims_hash,
        &expires,
        &owner,
    );

    // Verify credential
    let verified = client.verify_credential(&credential_id);
    assert_eq!(verified.issuer, issuer_did);
    assert_eq!(verified.subject, subject_did);
    assert_eq!(verified.credential_type, credential_type);
    assert_eq!(verified.claims_hash, claims_hash);
    assert!(!verified.revoked);
    assert_eq!(verified.expires, expires);
}

#[test]
fn test_revoke_credential() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Register issuer DID
    let issuer_did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let issuer_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    client.register_did(&issuer_did, &issuer_key, &None, &owner);

    // Register subject DID
    let subject_did = Bytes::from_slice(&env, b"did:stellar:BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF");
    let subject_key = Bytes::from_slice(&env, b"BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF");
    client.register_did(&subject_did, &subject_key, &None, &owner);

    // Issue credential
    let credential_type = String::from_str(&env, "UniversityDegree");
    let claims_hash = Bytes::from_slice(&env, b"hash_of_claims_data");

    let credential_id = client.issue_credential(
        &issuer_did,
        &subject_did,
        &credential_type,
        &claims_hash,
        &None,
        &owner,
    );

    // Revoke credential
    client.revoke_credential(&credential_id, &owner);

    // Try to verify revoked credential
    let result = client.try_verify_credential(&credential_id);
    assert!(result.is_err());
}

#[test]
fn test_deactivate_did() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Register DID
    let did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let public_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    client.register_did(&did, &public_key, &None, &owner);

    // Deactivate DID
    client.deactivate_did(&did, &owner);

    // Verify deactivation
    let resolved = client.resolve_did(&did);
    assert!(!resolved.active);
}

#[test]
fn test_did_exists() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Check non-existent DID
    let did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    assert!(!client.did_exists(&did));

    // Register DID
    let public_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    client.register_did(&did, &public_key, &None, &owner);

    // Check existing DID
    assert!(client.did_exists(&did));
}

#[test]
fn test_credential_exists() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let version = String::from_str(&env, "1.0.0");
    let network = String::from_str(&env, "testnet");

    let contract_id = env.register_contract(
        None,
        DIDContract,
        (&version, &network, &owner)
    );
    let client = DIDContractClient::new(&env, &contract_id);

    // Register issuer DID
    let issuer_did = Bytes::from_slice(&env, b"did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    let issuer_key = Bytes::from_slice(&env, b"GABCDEFGHIJKLMNOPQRSTUVWXYZ");
    client.register_did(&issuer_did, &issuer_key, &None, &owner);

    // Register subject DID
    let subject_did = Bytes::from_slice(&env, b"did:stellar:BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF");
    let subject_key = Bytes::from_slice(&env, b"BCDEFGHIJKLMNOPQRSTUVWXYZABCDEF");
    client.register_did(&subject_did, &subject_key, &None, &owner);

    // Check non-existent credential
    let credential_id = Bytes::from_slice(&env, b"non_existent_credential_id");
    assert!(!client.credential_exists(&credential_id));

    // Issue credential
    let credential_type = String::from_str(&env, "UniversityDegree");
    let claims_hash = Bytes::from_slice(&env, b"hash_of_claims_data");

    let issued_id = client.issue_credential(
        &issuer_did,
        &subject_did,
        &credential_type,
        &claims_hash,
        &None,
        &owner,
    );

    // Check existing credential
    assert!(client.credential_exists(&issued_id));
}