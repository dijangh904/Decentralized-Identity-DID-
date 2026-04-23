import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Grid, Typography, Card, CardContent } from "@mui/material";
import QRScanner from "../components/QRScanner";
import QRGenerator from "../components/QRGenerator";
import { resolveRoute } from "../utils/qrPayload";

const SAMPLE_PAYLOAD = {
  type: "did",
  did: "did:stellar:GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZ",
};

const Scanner = () => {
  const navigate = useNavigate();
  const [lastPayload, setLastPayload] = useState(null);

  const handleScan = (payload) => {
    setLastPayload(payload);
    const { route, fieldValue } = resolveRoute(payload);
    navigate(route, { state: { fieldValue } });
  };

  const generatorPayload = lastPayload || SAMPLE_PAYLOAD;

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        QR Code Scanner
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Scan a QR code to resolve a DID, verify a credential, or initiate a
        wallet connection.
      </Typography>

      <Grid container spacing={4}>
        {/* Scanner */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scan QR Code
              </Typography>
              <QRScanner onScan={handleScan} />
            </CardContent>
          </Card>
        </Grid>

        {/* Generator */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {lastPayload ? "Last Scanned Payload" : "Sample QR Code"}
              </Typography>
              <QRGenerator payload={generatorPayload} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Scanner;
