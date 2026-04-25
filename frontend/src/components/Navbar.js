import React, { useState } from "react";
import { NavLink } from "react-router-dom";
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

const navItems = [
  { label: "Dashboard", to: "/" },
  { label: "Credentials", to: "/credentials" },
  { label: "Create DID", to: "/create-did" },
  { label: "Resolve DID", to: "/resolve-did" },
  { label: "Verify", to: "/verify-credential" },
  { label: "QR Tools", to: "/scanner" },
  { label: "Account", to: "/account" },
];

const DRAWER_WIDTH = 260;

const Navbar = () => {
  const { wallet, isConnected } = useWallet();
  const { mode, toggleTheme } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleDrawerToggle = () => setDrawerOpen((prev) => !prev);

  const drawerContent = (
    <Box
      sx={{ width: DRAWER_WIDTH, pt: 2 }}
      role="presentation"
      onClick={() => setDrawerOpen(false)}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2, pb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "10px",
            display: "grid",
            placeItems: "center",
            background:
              "linear-gradient(135deg, rgba(90,209,230,0.9), rgba(255,184,77,0.9))",
            color: "#081117",
          }}
        >
          <QrCodeScanner fontSize="small" />
        </Box>
        <Typography variant="subtitle1" fontWeight="bold">
          Stellar DID
        </Typography>
      </Stack>

      <Divider />

      <List>
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={NavLink}
              to={item.to}
              sx={{
                borderRadius: 1,
                mx: 1,
                my: 0.25,
                "&.active": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemText-primary": { fontWeight: "bold" },
                },
              }}
            >
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mt: 1, mb: 2 }} />

      <Box sx={{ px: 2 }}>
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
          sx={{ width: "100%" }}
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
          borderBottom: "1px solid",
          borderColor: "divider",
          backgroundColor:
            mode === "dark"
              ? "rgba(9, 19, 26, 0.88)"
              : "rgba(255,255,255,0.82)",
        }}
      >
        <Toolbar sx={{ gap: 1, justifyContent: "space-between" }}>
          {/* Brand */}
          <Stack direction="row" spacing={1} alignItems="center">
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="Open navigation menu"
                edge="start"
                onClick={handleDrawerToggle}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: "12px",
                display: "grid",
                placeItems: "center",
                background:
                  "linear-gradient(135deg, rgba(90,209,230,0.9), rgba(255,184,77,0.9))",
                color: "#081117",
                flexShrink: 0,
              }}
            >
              <QrCodeScanner fontSize="small" />
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
