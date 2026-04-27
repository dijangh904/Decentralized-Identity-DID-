import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import LanguageSelector from "./LanguageSelector";

const linkSx = {
  color: "inherit",
  textDecoration: "none",
  "&.active": {
    opacity: 1,
  },
};

const Navbar = () => {
  const { t } = useTranslation();
  const { wallet, isConnected } = useWallet();

  const navItems = [
    { label: t("navigation.dashboard"), to: "/" },
    { label: t("navigation.credentials"), to: "/credentials" },
    { label: t("navigation.createDid"), to: "/create-did" },
    { label: t("navigation.resolveDid"), to: "/resolve-did" },
    { label: "Performance Test", to: "/performance-test" },
    { label: t("navigation.connectWallet"), to: "/connect" },
    { label: t("navigation.scanner"), to: "/scanner" },
    { label: t("navigation.account"), to: "/account" },
  ];

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

          <LanguageSelector />

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
