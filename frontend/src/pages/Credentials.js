import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Alert,
} from "@mui/material";
import CredentialList from "../components/CredentialList";
import CredentialManager from "../components/CredentialManager";

const Credentials = () => {
  const location = useLocation();
  const credentialId = location.state?.fieldValue;
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleCredentialSelect = (credential) => {
    // Handle credential selection - could open a modal or navigate to detail view
    console.log("Selected credential:", credential);
  };

  return (
    <Box component="main" aria-label="Credentials page">
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Verifiable Credentials
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage, issue, and verify verifiable credentials on the Stellar blockchain
      </Typography>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Browse Credentials" />
          <Tab label="Issue & Verify" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && (
        <CredentialList onCredentialSelect={handleCredentialSelect} />
      )}

      {activeTab === 1 && (
        <Card>
          <CardContent>
            {credentialId ? (
              <Alert severity="info">
                QR-scanned credential ID: {credentialId}
              </Alert>
            ) : (
              <Alert severity="warning">
                No credential ID was provided yet. Scan a credential QR code from
                the QR tools page to prefill this view.
              </Alert>
            )}
            <Box sx={{ mt: 3 }}>
              <CredentialManager />
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default Credentials;
