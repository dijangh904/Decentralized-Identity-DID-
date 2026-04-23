process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test_secret_for_jest";

// Stub out the Stellar contract module that isn't available in test env
jest.mock("../../contracts/stellar/DIDContract", () => ({}), { virtual: true });
