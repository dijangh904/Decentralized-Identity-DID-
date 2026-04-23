const TestUtils = require('./testUtils');

class TestData {
  /**
   * Generate valid DID data
   */
  static validDID(overrides = {}) {
    return {
      did: overrides.did || TestUtils.generateRandomDID(),
      publicKey: overrides.publicKey || TestUtils.generateRandomStellarAddress(),
      serviceEndpoint: overrides.serviceEndpoint || 'https://did.example.com/service',
      verificationMethods: overrides.verificationMethods || [
        {
          id: 'key-1',
          type: 'Ed25519VerificationKey2018',
          controller: overrides.did || TestUtils.generateRandomDID(),
          publicKeyBase58: TestUtils.generateRandomStellarAddress()
        }
      ],
      services: overrides.services || [
        {
          id: 'hub',
          type: 'IdentityHub',
          serviceEndpoint: 'https://hub.example.com'
        }
      ],
      ...overrides
    };
  }

  /**
   * Generate valid DID with verification methods
   */
  static validDIDWithVerificationMethods(overrides = {}) {
    return this.validDID({
      verificationMethods: [
        {
          id: 'key-1',
          type: 'Ed25519VerificationKey2018',
          controller: TestUtils.generateRandomDID(),
          publicKeyBase58: TestUtils.generateRandomStellarAddress()
        },
        {
          id: 'key-2',
          type: 'Ed25519VerificationKey2018',
          controller: TestUtils.generateRandomDID(),
          publicKeyBase58: TestUtils.generateRandomStellarAddress()
        }
      ],
      services: [
        {
          id: 'hub',
          type: 'IdentityHub',
          serviceEndpoint: 'https://hub.example.com'
        },
        {
          id: 'repository',
          type: 'Repository',
          serviceEndpoint: 'https://repo.example.com'
        }
      ],
      ...overrides
    });
  }

  /**
   * Generate invalid DID data
   */
  static invalidDID(overrides = {}) {
    return {
      did: 'invalid-did-format',
      publicKey: 'invalid-public-key',
      serviceEndpoint: 'not-a-url',
      verificationMethods: [],
      services: [],
      ...overrides
    };
  }

  /**
   * Generate valid credential data
   */
  static validCredential(overrides = {}) {
    return {
      issuer: overrides.issuer || TestUtils.generateRandomDID(),
      subject: overrides.subject || TestUtils.generateRandomDID(),
      credentialType: overrides.credentialType || 'VerifiableCredential',
      claims: overrides.claims || {
        name: 'John Doe',
        email: 'john@example.com',
        degree: 'Bachelor of Science',
        university: 'Example University'
      },
      expires: overrides.expires || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      credentialSchema: overrides.credentialSchema || {
        id: 'https://example.com/schemas/credential-v1.json',
        type: 'JsonSchemaValidator2018'
      },
      ...overrides
    };
  }

  /**
   * Generate degree credential
   */
  static degreeCredential(overrides = {}) {
    return this.validCredential({
      credentialType: 'DegreeCredential',
      claims: {
        degree: {
          type: 'BachelorDegree',
          name: 'Computer Science',
          major: 'Software Engineering',
          university: 'Example University'
        },
        graduationDate: '2023-06-01',
        gpa: '3.8',
        honors: 'Cum Laude'
      },
      ...overrides
    });
  }

  /**
   * Generate employment credential
   */
  static employmentCredential(overrides = {}) {
    return this.validCredential({
      credentialType: 'EmploymentCredential',
      claims: {
        position: 'Software Engineer',
        company: 'Tech Company Inc',
        startDate: '2022-01-01',
        current: true,
        responsibilities: [
          'Develop web applications',
          'Maintain code quality',
          'Participate in code reviews'
        ],
        skills: ['JavaScript', 'React', 'Node.js', 'MongoDB']
      },
      ...overrides
    });
  }

  /**
   * Generate identity credential
   */
  static identityCredential(overrides = {}) {
    return this.validCredential({
      credentialType: 'IdentityCredential',
      claims: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'US',
        passportNumber: '123456789',
        identificationDocument: {
          type: 'Passport',
          number: '123456789',
          issuingCountry: 'US',
          issuedDate: '2020-01-01',
          expiryDate: '2030-01-01'
        }
      },
      ...overrides
    });
  }

  /**
   * Generate invalid credential data
   */
  static invalidCredential(overrides = {}) {
    return {
      issuer: '',
      subject: '',
      credentialType: '',
      claims: null,
      expires: 'invalid-date',
      ...overrides
    };
  }

  /**
   * Generate expired credential
   */
  static expiredCredential(overrides = {}) {
    return this.validCredential({
      expires: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      ...overrides
    });
  }

  /**
   * Generate valid Stellar transaction
   */
  static validStellarTransaction(overrides = {}) {
    return {
      sourceAccount: overrides.sourceAccount || TestUtils.generateRandomStellarAddress(),
      operations: overrides.operations || [
        {
          type: 'payment',
          destination: TestUtils.generateRandomStellarAddress(),
          amount: '10.0000000',
          asset: 'native'
        }
      ],
      memo: overrides.memo || 'Test transaction',
      fee: overrides.fee || 100,
      ...overrides
    };
  }

  /**
   * Generate complex Stellar transaction
   */
  static complexStellarTransaction(overrides = {}) {
    return this.validStellarTransaction({
      operations: [
        {
          type: 'payment',
          destination: TestUtils.generateRandomStellarAddress(),
          amount: '50.0000000',
          asset: 'native'
        },
        {
          type: 'payment',
          destination: TestUtils.generateRandomStellarAddress(),
          amount: '25.0000000',
          asset: {
            code: 'USD',
            issuer: TestUtils.generateRandomStellarAddress()
          }
        },
        {
          type: 'set_options',
          signer: {
            ed25519PublicKey: TestUtils.generateRandomStellarAddress(),
            weight: 1
          }
        }
      ],
      memo: 'Complex test transaction',
      fee: 300,
      ...overrides
    });
  }

  /**
   * Generate invalid Stellar transaction
   */
  static invalidStellarTransaction(overrides = {}) {
    return {
      sourceAccount: 'invalid-address',
      operations: [],
      fee: -1,
      ...overrides
    };
  }

  /**
   * Generate user data
   */
  static userData(overrides = {}) {
    return {
      walletAddress: overrides.walletAddress || TestUtils.generateRandomStellarAddress(),
      email: overrides.email || 'test@example.com',
      roles: overrides.roles || ['USER'],
      active: overrides.active !== undefined ? overrides.active : true,
      preferences: overrides.preferences || {
        notifications: true,
        currency: 'USD',
        language: 'en'
      },
      profile: overrides.profile || {
        firstName: 'John',
        lastName: 'Doe',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Test user bio'
      },
      ...overrides
    };
  }

  /**
   * Generate admin user data
   */
  static adminUserData(overrides = {}) {
    return this.userData({
      roles: ['USER', 'ADMIN'],
      email: 'admin@example.com',
      ...overrides
    });
  }

  /**
   * Generate issuer user data
   */
  static issuerUserData(overrides = {}) {
    return this.userData({
      roles: ['USER', 'ISSUER'],
      email: 'issuer@example.com',
      ...overrides
    });
  }

  /**
   * Generate verifier user data
   */
  static verifierUserData(overrides = {}) {
    return this.userData({
      roles: ['USER', 'VERIFIER'],
      email: 'verifier@example.com',
      ...overrides
    });
  }

  /**
   * Generate marketplace listing
   */
  static marketplaceListing(overrides = {}) {
    return {
      type: overrides.type || 'service',
      title: overrides.title || 'DID Verification Service',
      description: overrides.description || 'Professional DID verification and validation service',
      price: overrides.price || 10,
      currency: overrides.currency || 'XLM',
      tags: overrides.tags || ['verification', 'security', 'identity'],
      category: overrides.category || 'Security',
      images: overrides.images || ['https://example.com/image1.jpg'],
      specifications: overrides.specifications || {
        verificationLevel: 'Standard',
        turnaroundTime: '24 hours',
        supportedNetworks: ['Stellar', 'Ethereum']
      },
      ...overrides
    };
  }

  /**
   * Generate marketplace review
   */
  static marketplaceReview(overrides = {}) {
    return {
      listingId: overrides.listingId || TestUtils.generateRandomString(),
      rating: overrides.rating || 5,
      comment: overrides.comment || 'Excellent service, highly recommended!',
      userId: overrides.userId || TestUtils.generateRandomString(),
      verifiedPurchase: overrides.verifiedPurchase !== undefined ? overrides.verifiedPurchase : true,
      createdAt: overrides.createdAt || new Date().toISOString(),
      ...overrides
    };
  }

  /**
   * Generate governance proposal
   */
  static governanceProposal(overrides = {}) {
    return {
      type: overrides.type || 'protocol_change',
      title: overrides.title || 'Update DID Schema Version',
      description: overrides.description || 'Proposal to update the DID document schema to version 2.0 with additional fields for enhanced functionality.',
      options: overrides.options || ['approve', 'reject', 'abstain'],
      votingPeriod: overrides.votingPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
      quorum: overrides.quorum || 0.5, // 50% participation required
      passThreshold: overrides.passThreshold || 0.6, // 60% approval required
      ...overrides
    };
  }

  /**
   * Generate notification data
   */
  static notificationData(overrides = {}) {
    return {
      type: overrides.type || 'info',
      title: overrides.title || 'Test Notification',
      message: overrides.message || 'This is a test notification',
      data: overrides.data || {},
      channels: overrides.channels || ['email', 'push'],
      priority: overrides.priority || 'normal',
      ...overrides
    };
  }

  /**
   * Generate analytics event
   */
  static analyticsEvent(overrides = {}) {
    return {
      eventType: overrides.eventType || 'user_action',
      userId: overrides.userId || TestUtils.generateRandomString(),
      data: overrides.data || {
        action: 'button_click',
        buttonId: 'submit-btn',
        page: '/dashboard'
      },
      timestamp: overrides.timestamp || new Date().toISOString(),
      userAgent: overrides.userAgent || 'Mozilla/5.0 (Test Browser)',
      ipAddress: overrides.ipAddress || '127.0.0.1',
      ...overrides
    };
  }

  /**
   * Generate contract data
   */
  static contractData(overrides = {}) {
    return {
      key: overrides.key || TestUtils.generateRandomString(10),
      value: overrides.value || TestUtils.generateRandomString(20),
      dataType: overrides.dataType || 'string',
      encrypted: overrides.encrypted !== undefined ? overrides.encrypted : false,
      ...overrides
    };
  }

  /**
   * Generate webhook configuration
   */
  static webhookConfig(overrides = {}) {
    return {
      url: overrides.url || 'https://example.com/webhook',
      events: overrides.events || ['did.created', 'credential.issued'],
      secret: overrides.secret || TestUtils.generateRandomString(32),
      active: overrides.active !== undefined ? overrides.active : true,
      retryAttempts: overrides.retryAttempts || 3,
      timeout: overrides.timeout || 30000,
      ...overrides
    };
  }

  /**
   * Generate batch of test data
   */
  static generateBatch(generator, count, overrides = {}) {
    const batch = [];
    for (let i = 0; i < count; i++) {
      const item = generator({ ...overrides, index: i });
      batch.push(item);
    }
    return batch;
  }

  /**
   * Generate test scenario data
   */
  static testScenario(scenario) {
    switch (scenario) {
      case 'full-did-lifecycle':
        return {
          did: this.validDID(),
          updates: [
            { serviceEndpoint: 'https://updated1.example.com' },
            { publicKey: TestUtils.generateRandomStellarAddress() }
          ],
          credentials: [
            this.degreeCredential(),
            this.employmentCredential()
          ]
        };
        
      case 'credential-verification':
        return {
          validCredential: this.validCredential(),
          invalidCredential: this.invalidCredential(),
          expiredCredential: this.expiredCredential(),
          revokedCredential: this.validCredential({ revoked: true })
        };
        
      case 'stellar-transactions':
        return {
          simpleTransaction: this.validStellarTransaction(),
          complexTransaction: this.complexStellarTransaction(),
          invalidTransaction: this.invalidStellarTransaction()
        };
        
      case 'marketplace-interaction':
        return {
          listing: this.marketplaceListing(),
          review: this.marketplaceReview(),
          purchase: {
            listingId: TestUtils.generateRandomString(),
            quantity: 1,
            totalPrice: 10
          }
        };
        
      case 'governance-process':
        return {
          proposal: this.governanceProposal(),
          votes: [
            { userId: TestUtils.generateRandomString(), option: 'approve' },
            { userId: TestUtils.generateRandomString(), option: 'reject' }
          ]
        };
        
      default:
        return {};
    }
  }

  /**
   * Generate performance test data
   */
  static performanceTestData(size = 'medium') {
    const sizes = {
      small: { dids: 10, credentials: 20, transactions: 5 },
      medium: { dids: 100, credentials: 200, transactions: 50 },
      large: { dids: 1000, credentials: 2000, transactions: 500 },
      xlarge: { dids: 10000, credentials: 20000, transactions: 5000 }
    };
    
    const config = sizes[size] || sizes.medium;
    
    return {
      dids: this.generateBatch(this.validDID, config.dids),
      credentials: this.generateBatch(this.validCredential, config.credentials),
      transactions: this.generateBatch(this.validStellarTransaction, config.transactions)
    };
  }

  /**
   * Generate edge case data
   */
  static edgeCaseData() {
    return {
      emptyStrings: {
        did: '',
        publicKey: '',
        serviceEndpoint: ''
      },
      nullValues: {
        did: null,
        publicKey: null,
        serviceEndpoint: null
      },
      undefinedValues: {
        did: undefined,
        publicKey: undefined,
        serviceEndpoint: undefined
      },
      veryLongStrings: {
        did: 'did:stellar:' + 'A'.repeat(1000),
        publicKey: 'G' + 'A'.repeat(100),
        serviceEndpoint: 'https://' + 'a'.repeat(1000) + '.com'
      },
      specialCharacters: {
        did: 'did:stellar:GABC!@#$%^&*()1234567890ABCDEF',
        publicKey: 'GABC!@#$%^&*()1234567890ABCDEF',
        serviceEndpoint: 'https://example.com/path?param=value&other=123#fragment'
      },
      unicodeCharacters: {
        did: 'did:stellar:GABCñáéíóú1234567890ABCDEF',
        publicKey: 'GABCñáéíóú1234567890ABCDEF',
        serviceEndpoint: 'https://example.com/路径/参数'
      }
    };
  }

  /**
   * Generate malformed JSON data
   */
  static malformedJSON() {
    return [
      '{ "key": "value" ', // Missing closing brace
      '{ "key": "value", }', // Trailing comma
      '{ "key": undefined }', // Undefined value
      '{ "key": NaN }', // NaN value
      '{ "key": Infinity }', // Infinity value
      '{ "key": function() {} }', // Function value
      'not json at all', // Not JSON
      '', // Empty string
      '{"nested": {"deep": {"deeper": "value"}}}', // Deeply nested
      '{"array": [1, 2, 3,]}', // Trailing comma in array
      '{"key": "value\nwith\nnewlines"}' // Newlines in string
    ];
  }

  /**
   * Generate security test data
   */
  static securityTestData() {
    return {
      sqlInjection: [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1'; DELETE FROM users WHERE '1'='1",
        "UNION SELECT * FROM users",
        "'; INSERT INTO users VALUES('hacker', 'password'); --"
      ],
      xss: [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')">',
        '<svg onload="alert(\'xss\')">',
        '"><script>alert("xss")</script>'
      ],
      pathTraversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
      ],
      commandInjection: [
        '; ls -la',
        '| cat /etc/passwd',
        '&& echo "hacked"',
        '`whoami`',
        '$(id)'
      ]
    };
  }
}

module.exports = TestData;
