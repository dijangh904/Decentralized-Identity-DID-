import React from "react";
import { NavLink } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { QrCodeScanner, AccountBalanceWallet } from "@mui/icons-material";
import { useWallet } from "../contexts/WalletContext";

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Credentials", to: "/credentials" },
  { label: "Create DID", to: "/create-did" },
  { label: "Resolve DID", to: "/resolve-did" },
  { label: "Performance Test", to: "/performance-test" },
  { label: "Connect Wallet", to: "/connect" },
  { label: "QR Tools", to: "/scanner" },
  { label: "Account", to: "/account" },
];

const linkSx = {
  color: "inherit",
  textDecoration: "none",
  "&.active": {
    opacity: 1,
  },
};

const Navbar = () => {
  const { wallet, isConnected } = useWallet();

  return (
    <AppBar
      position="sticky"
      color="transparent"
      sx={{
        backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        backgroundColor: "rgba(9, 19, 26, 0.78)",
      }}
    >
      <Toolbar
        sx={{
          gap: 2,
          justifyContent: "space-between",
          flexWrap: "wrap",
          py: 1,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: "14px",
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, rgba(90,209,230,0.9), rgba(255,184,77,0.9))",
              color: "#081117",
            }}
          >
            <QrCodeScanner />
          </Box>
          <Box>
            <Typography variant="h6">Stellar DID Platform</Typography>
            <Typography variant="caption" color="text.secondary">
              Mobile-ready QR wallet flows
            </Typography>
          </Box>
        </Stack>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Stack
            direction="row"
            spacing={0.5}
            flexWrap="wrap"
            useFlexGap
            sx={{ justifyContent: { xs: "flex-start", md: "center" } }}
          >
            {navItems.map((item) => (
              <Button
                key={item.to}
                component={NavLink}
                to={item.to}
                sx={linkSx}
                color="inherit"
              >
                {item.label}
              </Button>
            ))}
          </Stack>

          <Chip
            icon={<AccountBalanceWallet />}
            color={isConnected ? "success" : "default"}
            label={
              isConnected
                ? `Wallet ${wallet?.publicKey?.slice(0, 6)}...${wallet?.publicKey?.slice(-4)}`
                : "No wallet connected"
            }
            variant={isConnected ? "filled" : "outlined"}
          />
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
