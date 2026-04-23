import requests

class StellarDIDError(Exception):
    pass

class StellarDIDClient:
    def __init__(self, api_url="http://localhost:3001/api/v1"):
        self.api_url = api_url
        self.session = requests.Session()

    def _handle_response(self, response):
        if response.status_code >= 400:
            raise StellarDIDError(f"Error {response.status_code}: {response.text}")
        return response.json()

    def get_did(self, did: str):
        res = self.session.get(f"{self.api_url}/did/{did}")
        return self._handle_response(res)

    def create_did(self, did_data: dict, token: str):
        headers = {"Authorization": f"Bearer {token}"}
        res = self.session.post(f"{self.api_url}/did", json=did_data, headers=headers)
        return self._handle_response(res)

    def issue_credential(self, credential_data: dict, token: str):
        headers = {"Authorization": f"Bearer {token}"}
        res = self.session.post(f"{self.api_url}/credentials", json=credential_data, headers=headers)
        return self._handle_response(res)

    def verify_credential(self, credential_data: dict):
        res = self.session.post(f"{self.api_url}/credentials/verify", json=credential_data)
        return self._handle_response(res)

    def revoke_credential(self, credential_id: str, token: str):
        headers = {"Authorization": f"Bearer {token}"}
        res = self.session.delete(f"{self.api_url}/credentials/{credential_id}", headers=headers)
        return self._handle_response(res)