import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  AccountBalanceWallet,
  Brightness4,
  Brightness7,
  Menu as MenuIcon,
  QrCodeScanner,
} from "@mui/icons-material";
import { useWallet } from "../contexts/WalletContext";
import { useThemeMode } from "../contexts/ThemeContext";
import LanguageSelector from "./LanguageSelector";

const DRAWER_WIDTH = 260;

const Navbar = () => {
  const { t } = useTranslation();
  const { wallet, isConnected } = useWallet();
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { label: t("navigation.dashboard"), to: "/" },
    { label: t("navigation.credentials"), to: "/credentials" },
    { label: t("navigation.createDid"), to: "/create-did" },
    { label: t("navigation.resolveDid"), to: "/resolve-did" },
    { label: "Verify", to: "/verify-credential" },
    { label: t("navigation.scanner"), to: "/scanner" },
    { label: t("navigation.account"), to: "/account" },
  ];

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const drawerContent = (
    <Box onClick={handleDrawerToggle} sx={{ textAlign: 'center' }}>
      <Typography variant="h6" sx={{ my: 2 }}>
        Stellar DID Platform
      </Typography>
      <Divider />
      <List>
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton sx={{ textAlign: 'center' }} component={NavLink} to={item.to}>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <LanguageSelector />
        <Chip
          icon={<AccountBalanceWallet />}
          color={isConnected ? "success" : "default"}
          label={
            isConnected
              ? `${wallet?.publicKey?.slice(0, 6)}...${wallet?.publicKey?.slice(-4)}`
              : "No wallet"
          }
          variant={isConnected ? "filled" : "outlined"}
          size="small"
          sx={{ mt: 1 }}
        />
      </Box>
    </Box>
  );

  return (
    <>
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
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
              >
                <MenuIcon />
              </IconButton>
            )}
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
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography variant="h6" noWrap>
                Stellar DID Platform
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Decentralized Identity
              </Typography>
            </Box>
          </Stack>

          {/* Desktop nav */}
          {!isMobile && (
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              sx={{ flex: 1, justifyContent: "center" }}
            >
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  color="inherit"
                  size="small"
                  sx={{
                    textDecoration: "none",
                    "&.active": { fontWeight: "bold", opacity: 1 },
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Stack>
          )}

          {/* Right actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            <LanguageSelector />
            
            <Tooltip
              title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
            >
              <IconButton
                color="inherit"
                onClick={toggleTheme}
                aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
                size="small"
              >
                {mode === "dark" ? <Brightness7 /> : <Brightness4 />}
              </IconButton>
            </Tooltip>

            {!isMobile && (
              <Chip
                icon={<AccountBalanceWallet />}
                color={isConnected ? "success" : "default"}
                label={
                  isConnected
                    ? `${wallet?.publicKey?.slice(0, 6)}...${wallet?.publicKey?.slice(-4)}`
                    : "No wallet"
                }
                variant={isConnected ? "filled" : "outlined"}
                size="small"
              />
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
};

export default Navbar;
