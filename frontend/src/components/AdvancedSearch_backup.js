import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Search,
  FilterList,
  Clear,
  ExpandMore as ExpandMoreIcon,
  Save,
  Delete,
  Refresh
} from '@mui/icons-material';

const AdvancedSearch = ({ onSearch, onFiltersChange, loading }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [savedSearches, setSavedSearches] = useState([]);
  
  const [searchParams, setSearchParams] = useState({
    // Basic search
    query: '',
    
    // Filters
    credentialType: '',
    issuer: '',
    subject: '',
    status: '',
    
    // Date filters
    issuedAfter: null,
    issuedBefore: null,
    expiresAfter: null,
    expiresBefore: null,
    
    // Advanced options
    sortBy: 'issued',
    sortOrder: 'desc',
    includeRevoked: false,
    includeExpired: false,
    
    // Search scope
    searchIn: ['id', 'issuer', 'subject', 'claims'], // Where to search the query
  });

  const handleSearch = () => {
    onSearch(searchParams);
  };

  const handleClear = () => {
    const clearedParams = {
      query: '',
      credentialType: '',
      issuer: '',
      subject: '',
      status: '',
      issuedAfter: null,
      issuedBefore: null,
      expiresAfter: null,
      expiresBefore: null,
      sortBy: 'issued',
      sortOrder: 'desc',
      includeRevoked: false,
      includeExpired: false,
      searchIn: ['id', 'issuer', 'subject', 'claims'],
    };
    setSearchParams(clearedParams);
    onFiltersChange(clearedParams);
  };

  const handleSaveSearch = () => {
    const searchName = prompt('Enter a name for this search:');
    if (searchName && searchParams.query) {
      setSavedSearches(prev => [...prev, { name: searchName, params: { ...searchParams } }]);
    }
  };

  const handleLoadSavedSearch = (savedSearch) => {
    setSearchParams(savedSearch.params);
    onFiltersChange(savedSearch.params);
  };

  const handleDeleteSavedSearch = (index) => {
    setSavedSearches(prev => prev.filter((_, i) => i !== index));
  };

  const updateParam = (key, value) => {
    const newParams = { ...searchParams, [key]: value };
    setSearchParams(newParams);
    onFiltersChange(newParams);
  };

  const hasActiveFilters = () => {
    return searchParams.query || 
           searchParams.credentialType || 
           searchParams.issuer || 
           searchParams.subject || 
           searchParams.status ||
           searchParams.issuedAfter ||
           searchParams.issuedBefore ||
           searchParams.expiresAfter ||
           searchParams.expiresBefore ||
           searchParams.includeRevoked ||
           searchParams.includeExpired;
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">{t("actions.search")}</Typography>
            {hasActiveFilters() && (
              <Chip 
                label="Active Filters" 
                color="primary" 
                size="small" 
                onDelete={handleClear}
              />
            )}
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Save current search">
              <IconButton size="small" onClick={handleSaveSearch} disabled={!hasActiveFilters()}>
                <Save />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear all filters">
              <IconButton size="small" onClick={handleClear}>
                <Clear />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Quick Search Bar */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              placeholder={t("credentials.searchPlaceholder")}
              value={searchParams.query}
              onChange={(e) => updateParam('query', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                endAdornment: searchParams.query && (
                  <IconButton size="small" onClick={() => updateParam('query', '')}>
                    <Clear />
                  </IconButton>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSearch}
              disabled={loading}
              startIcon={<Search />}
              sx={{ height: '56px' }}
            >
              {loading ? t("messages.loading") : t("actions.search")}
            </Button>
          </Grid>
        </Grid>

        {/* Advanced Filters */}
        <Accordion expanded={expanded} onChange={() => setExpanded(!expanded)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={1}>
              <FilterList />
              <Typography>Advanced Filters</Typography>
              {hasActiveFilters() && (
                <Chip label="Active" size="small" color="secondary" />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {/* Basic Filters */}
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t("credentials.type")}</InputLabel>
                  <Select
                    value={searchParams.credentialType}
                    label={t("credentials.type")}
                    onChange={(e) => updateParam('credentialType', e.target.value)}
                  >
                    <MenuItem value="">{t("credentials.allTypes")}</MenuItem>
                    <MenuItem value="university-degree">{t("types.universityDegree")}</MenuItem>
                    <MenuItem value="professional-license">{t("types.professionalLicense")}</MenuItem>
                    <MenuItem value="age-verification">{t("types.ageVerification")}</MenuItem>
                    <MenuItem value="employment-verification">{t("types.employmentVerification")}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Issuer"
                  value={searchParams.issuer}
                  onChange={(e) => updateParam('issuer', e.target.value)}
                  placeholder="Filter by issuer DID..."
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Subject"
                  value={searchParams.subject}
                  onChange={(e) => updateParam('subject', e.target.value)}
                  placeholder="Filter by subject DID..."
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>{t("credentials.status")}</InputLabel>
                  <Select
                    value={searchParams.status}
                    label={t("credentials.status")}
                    onChange={(e) => updateParam('status', e.target.value)}
                  >
                    <MenuItem value="">{t("credentials.allStatus")}</MenuItem>
                    <MenuItem value="valid">{t("status.valid")}</MenuItem>
                    <MenuItem value="revoked">{t("status.revoked")}</MenuItem>
                    <MenuItem value="expired">{t("status.expired")}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Date Filters */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Date Range Filters
                </Typography>
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Issued After"
                  type="date"
                  value={searchParams.issuedAfter || ''}
                  onChange={(e) => updateParam('issuedAfter', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Issued Before"
                  type="date"
                  value={searchParams.issuedBefore || ''}
                  onChange={(e) => updateParam('issuedBefore', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Expires After"
                  type="date"
                  value={searchParams.expiresAfter || ''}
                  onChange={(e) => updateParam('expiresAfter', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  label="Expires Before"
                  type="date"
                  value={searchParams.expiresBefore || ''}
                  onChange={(e) => updateParam('expiresBefore', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Sorting Options */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Sorting Options
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>{t("credentials.sortBy")}</InputLabel>
                  <Select
                    value={searchParams.sortBy}
                    label={t("credentials.sortBy")}
                    onChange={(e) => updateParam('sortBy', e.target.value)}
                  >
                    <MenuItem value="issued">{t("credentials.issuedDate")}</MenuItem>
                    <MenuItem value="expires">{t("credentials.expirationDate")}</MenuItem>
                    <MenuItem value="credentialType">{t("credentials.type")}</MenuItem>
                    <MenuItem value="issuer">{t("credentials.issuer")}</MenuItem>
                    <MenuItem value="subject">{t("credentials.subject")}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Sort Order</InputLabel>
                  <Select
                    value={searchParams.sortOrder}
                    label="Sort Order"
                    onChange={(e) => updateParam('sortOrder', e.target.value)}
                  >
                    <MenuItem value="desc">Newest First</MenuItem>
                    <MenuItem value="asc">Oldest First</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Advanced Options */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Advanced Options
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={searchParams.includeRevoked}
                      onChange={(e) => updateParam('includeRevoked', e.target.checked)}
                    />
                  }
                  label="Include Revoked Credentials"
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={searchParams.includeExpired}
                      onChange={(e) => updateParam('includeExpired', e.target.checked)}
                    />
                  }
                  label="Include Expired Credentials"
                />
              </Grid>
            </Grid>

            {/* Saved Searches */}
            {savedSearches.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Saved Searches
                </Typography>
                <Grid container spacing={1}>
                  {savedSearches.map((saved, index) => (
                    <Grid item key={index}>
                      <Chip
                        label={saved.name}
                        onDelete={() => handleDeleteSavedSearch(index)}
                        onClick={() => handleLoadSavedSearch(saved)}
                        deleteIcon={<Delete />}
                        clickable
                      />
                    </Grid>
                  ))}
                </Grid>
              </>
            )}

            <Box mt={2} display="flex" gap={2}>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={loading}
                startIcon={<Search />}
              >
                {loading ? t("messages.loading") : t("actions.search")}
              </Button>
              <Button
                variant="outlined"
                onClick={handleClear}
                startIcon={<Clear />}
              >
                Clear Filters
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default AdvancedSearch;
