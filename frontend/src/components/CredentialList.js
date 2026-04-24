import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Fade,
  Skeleton,
  Alert,
  Divider
} from '@mui/material';
import {
  School,
  Work,
  CreditCard,
  Security,
  VerifiedUser,
  Search,
  FilterList,
  Refresh,
  Visibility,
  ContentCopy,
  CheckCircle,
  Error,
  AccessTime,
  Block
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { stellarAPI } from '../services/api';
import { handleApiError } from '../utils/errorHandler';
import ErrorDisplay from './ErrorDisplay';

// Virtual scrolling implementation
const useVirtualScroll = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      offsetY: startIndex * itemHeight
    };
  }, [items, itemHeight, containerHeight, scrollTop]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return { visibleItems, handleScroll };
};

// Credential card component
const CredentialCard = React.memo(({ credential, onView, onCopy }) => {
  const getCredentialIcon = (type) => {
    switch (type) {
      case 'university-degree':
        return <School />;
      case 'professional-license':
        return <Work />;
      case 'age-verification':
        return <CreditCard />;
      case 'employment-verification':
        return <Security />;
      default:
        return <VerifiedUser />;
    }
  };

  const getStatusColor = (credential) => {
    if (credential.revoked) return 'error';
    if (credential.expires && new Date(credential.expires) < new Date()) return 'warning';
    return 'success';
  };

  const getStatusText = (credential) => {
    if (credential.revoked) return 'Revoked';
    if (credential.expires && new Date(credential.expires) < new Date()) return 'Expired';
    return 'Valid';
  };

  return (
    <Card sx={{ mb: 2, transition: 'all 0.2s', '&:hover': { transform: 'translateY(2px)', boxShadow: 4 } }}>
      <CardContent>
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" flex={1}>
            {getCredentialIcon(credential.credentialType)}
            <Box ml={2} flex={1}>
              <Typography variant="h6" noWrap>
                {credential.credentialType?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                ID: {credential.id}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={getStatusText(credential)}
            color={getStatusColor(credential)}
            size="small"
            icon={credential.revoked ? <Block /> : credential.expires && new Date(credential.expires) < new Date() ? <AccessTime /> : <CheckCircle />}
          />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Issuer
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {credential.issuer}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Subject
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {credential.subject}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">
              Issued
            </Typography>
            <Typography variant="body2">
              {new Date(credential.issued).toLocaleDateString()}
            </Typography>
          </Grid>
          {credential.expires && (
            <Grid item xs={12} sm={6}>
              <Typography variant="body2" color="text.secondary">
                Expires
              </Typography>
              <Typography variant="body2">
                {new Date(credential.expires).toLocaleDateString()}
              </Typography>
            </Grid>
          )}
        </Grid>

        <Box display="flex" justifyContent="flex-end" mt={2} gap={1}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => onView(credential)}>
              <Visibility />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy ID">
            <IconButton size="small" onClick={() => onCopy(credential.id)}>
              <ContentCopy />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
});

CredentialCard.displayName = 'CredentialCard';

const CredentialList = ({ onCredentialSelect }) => {
  // State management
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [filters, setFilters] = useState({
    issuer: '',
    subject: '',
    credentialType: '',
    revoked: '',
    expired: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'virtual'
  const [sortBy, setSortBy] = useState('issued');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Virtual scrolling refs
  const containerRef = useRef(null);
  const itemHeight = 200; // Approximate height of each credential card
  const containerHeight = 600; // Fixed height for virtual scrolling container

  // Virtual scrolling hook
  const { visibleItems, handleScroll } = useVirtualScroll(
    credentials,
    itemHeight,
    containerHeight
  );

  // Fetch credentials
  const fetchCredentials = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const currentPage = resetPage ? 1 : page;
      const params = {
        limit: rowsPerPage,
        offset: (currentPage - 1) * rowsPerPage,
        sortBy,
        sortOrder,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await stellarAPI.credentials.getCredentials(params);
      setCredentials(response.data.credentials || []);
      setTotalCount(response.data.total || 0);
      
      if (resetPage) {
        setPage(1);
      }
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      toast.error(errorInfo.message);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters, searchQuery, sortBy, sortOrder]);

  // Initial fetch and effect dependencies
  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1);
  };

  // Handle search
  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
    setPage(1);
  };

  // Handle pagination
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  // Handle sort change
  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Copy credential ID
  const copyCredentialId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success('Credential ID copied to clipboard!');
  };

  // Refresh data
  const handleRefresh = () => {
    fetchCredentials(true);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      issuer: '',
      subject: '',
      credentialType: '',
      revoked: '',
      expired: ''
    });
    setSearchQuery('');
    setPage(1);
  };

  // Render skeleton loaders
  const renderSkeletons = () => {
    return Array.from({ length: rowsPerPage }).map((_, index) => (
      <Card key={`skeleton-${index}`} sx={{ mb: 2 }}>
        <CardContent>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={24} />
          <Box mt={2}>
            <Skeleton variant="rectangular" width="100%" height={80} />
          </Box>
        </CardContent>
      </Card>
    ));
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Credentials ({totalCount})
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant={viewMode === 'virtual' ? 'contained' : 'outlined'}
            onClick={() => setViewMode(viewMode === 'list' ? 'virtual' : 'list')}
          >
            {viewMode === 'virtual' ? 'List View' : 'Virtual Scroll'}
          </Button>
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <ErrorDisplay error={error} onClose={() => setError(null)} />
      )}

      {/* Filters and Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <FilterList sx={{ mr: 1 }} />
            <Typography variant="h6">Filters</Typography>
            <Box ml="auto">
              <Button size="small" onClick={clearFilters}>
                Clear All
              </Button>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search by ID, issuer, or subject..."
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.credentialType}
                  label="Type"
                  onChange={(e) => handleFilterChange('credentialType', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="university-degree">University Degree</MenuItem>
                  <MenuItem value="professional-license">Professional License</MenuItem>
                  <MenuItem value="age-verification">Age Verification</MenuItem>
                  <MenuItem value="employment-verification">Employment Verification</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.revoked}
                  label="Status"
                  onChange={(e) => handleFilterChange('revoked', e.target.value)}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="false">Valid</MenuItem>
                  <MenuItem value="true">Revoked</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Expiration</InputLabel>
                <Select
                  value={filters.expired}
                  label="Expiration"
                  onChange={(e) => handleFilterChange('expired', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="false">Not Expired</MenuItem>
                  <MenuItem value="true">Expired</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => handleSortChange(e.target.value)}
                >
                  <MenuItem value="issued">Issued Date</MenuItem>
                  <MenuItem value="expires">Expiration Date</MenuItem>
                  <MenuItem value="credentialType">Type</MenuItem>
                  <MenuItem value="issuer">Issuer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && credentials.length === 0 && (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty State */}
      {!loading && credentials.length === 0 && !error && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No credentials found matching your criteria.
        </Alert>
      )}

      {/* Credential List */}
      {!loading && credentials.length > 0 && (
        <>
          {viewMode === 'list' ? (
            // Standard list view with pagination
            <Fade in={!loading}>
              <Box>
                {credentials.map((credential) => (
                  <CredentialCard
                    key={credential.id}
                    credential={credential}
                    onView={onCredentialSelect}
                    onCopy={copyCredentialId}
                  />
                ))}
                
                {/* Pagination */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Rows per page</InputLabel>
                    <Select
                      value={rowsPerPage}
                      label="Rows per page"
                      onChange={handleRowsPerPageChange}
                    >
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={20}>20</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <Pagination
                    count={Math.ceil(totalCount / rowsPerPage)}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              </Box>
            </Fade>
          ) : (
            // Virtual scrolling view
            <Fade in={!loading}>
              <Box>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Showing {visibleItems.startIndex + 1}-{Math.min(visibleItems.endIndex, totalCount)} of {totalCount} credentials
                </Typography>
                
                <Paper
                  ref={containerRef}
                  sx={{
                    height: containerHeight,
                    overflow: 'auto',
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                  onScroll={handleScroll}
                >
                  <Box sx={{ height: credentials.length * itemHeight, position: 'relative' }}>
                    <Box sx={{ transform: `translateY(${visibleItems.offsetY}px)` }}>
                      {visibleItems.items.map((credential, index) => (
                        <Box key={credential.id} sx={{ height: itemHeight, p: 1 }}>
                          <CredentialCard
                            credential={credential}
                            onView={onCredentialSelect}
                            onCopy={copyCredentialId}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Paper>
                
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
                  <Typography variant="body2" color="text.secondary">
                    Virtual scrolling enabled for optimal performance
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setViewMode('list')}
                  >
                    Switch to List View
                  </Button>
                </Box>
              </Box>
            </Fade>
          )}
        </>
      )}

      {/* Loading overlay for pagination */}
      {loading && credentials.length > 0 && (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
};

export default CredentialList;
