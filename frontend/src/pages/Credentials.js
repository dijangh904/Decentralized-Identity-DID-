import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextareaAutosize
} from '@mui/material';
import {
  School,
  Work,
  CreditCard,
  Security,
  VerifiedUser,
  ContentCopy,
  CheckCircle,
  Error,
  Info
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { stellarAPI } from '../services/api';
import { useWallet } from '../contexts/WalletContext';
import { handleApiError } from '../utils/errorHandler';
import ErrorDisplay from '../components/ErrorDisplay';

const issueSchema = yup.object().shape({
  issuerDID: yup.string()
    .required('Issuer DID is required')
    .matches(/^did:stellar:G[A-Z0-9]{55}$/, 'Invalid DID format'),
  subjectDID: yup.string()
    .required('Subject DID is required')
    .matches(/^did:stellar:G[A-Z0-9]{55}$/, 'Invalid DID format'),
  credentialType: yup.string().required('Credential type is required'),
  claims: yup.string().required('Claims are required'),
});

const verifySchema = yup.object().shape({
  credentialId: yup.string().required('Credential ID is required'),
});

const Credentials = () => {
  const [activeTab, setActiveTab] = useState('issue');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const { wallet, isConnected } = useWallet();

  const issueForm = useForm({
    resolver: yupResolver(issueSchema),
    defaultValues: {
      issuerDID: '',
      subjectDID: '',
      credentialType: 'university-degree',
      claims: '',
    },
  });

  const verifyForm = useForm({
    resolver: yupResolver(verifySchema),
    defaultValues: {
      credentialId: '',
    },
  });

  React.useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await stellarAPI.credentials.getTemplates();
      setTemplates(response.data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleIssueCredential = async (data) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      let claims;
      try {
        claims = JSON.parse(data.claims);
      } catch (parseError) {
        throw new Error('Invalid JSON in claims field');
      }

      const response = await stellarAPI.contracts.issueCredential(
        data.issuerDID,
        data.subjectDID,
        data.credentialType,
        claims
      );
      
      setResult(response.data);
      toast.success('Credential issued successfully!');
      issueForm.reset();
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      toast.error(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCredential = async (data) => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await stellarAPI.contracts.verifyCredential({
        credentialId: data.credentialId
      });
      
      setResult(response.data);
      toast.success('Credential verification completed!');
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo);
      toast.error(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const useTemplate = (template) => {
    issueForm.setValue('credentialType', template.id);
    issueForm.setValue('claims', JSON.stringify(template.claims, null, 2));
  };

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

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Verifiable Credentials
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Issue and verify verifiable credentials on the Stellar blockchain
      </Typography>

      {/* Tab Navigation */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant={activeTab === 'issue' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('issue')}
          sx={{ mr: 2 }}
        >
          Issue Credential
        </Button>
        <Button
          variant={activeTab === 'verify' ? 'contained' : 'outlined'}
          onClick={() => setActiveTab('verify')}
        >
          Verify Credential
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Issue Credential Tab */}
        {activeTab === 'issue' && (
          <>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Issue New Credential
                  </Typography>
                  
                  <form onSubmit={issueForm.handleSubmit(handleIssueCredential)}>
                    <Controller
                      name="issuerDID"
                      control={issueForm.control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Issuer DID"
                          placeholder="did:stellar:G..."
                          fullWidth
                          margin="normal"
                          error={!!issueForm.formState.errors.issuerDID}
                          helperText={issueForm.formState.errors.issuerDID?.message}
                        />
                      )}
                    />

                    <Controller
                      name="subjectDID"
                      control={issueForm.control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Subject DID"
                          placeholder="did:stellar:G..."
                          fullWidth
                          margin="normal"
                          error={!!issueForm.formState.errors.subjectDID}
                          helperText={issueForm.formState.errors.subjectDID?.message}
                        />
                      )}
                    />

                    <Controller
                      name="credentialType"
                      control={issueForm.control}
                      render={({ field }) => (
                        <FormControl fullWidth margin="normal">
                          <InputLabel>Credential Type</InputLabel>
                          <Select {...field}>
                            <MenuItem value="university-degree">University Degree</MenuItem>
                            <MenuItem value="professional-license">Professional License</MenuItem>
                            <MenuItem value="age-verification">Age Verification</MenuItem>
                            <MenuItem value="employment-verification">Employment Verification</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />

                    <Controller
                      name="claims"
                      control={issueForm.control}
                      render={({ field }) => (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Claims (JSON format)
                          </Typography>
                          <TextareaAutosize
                            {...field}
                            minRows={6}
                            placeholder='{"degree": "Bachelor of Science", "university": "Example University"}'
                            style={{
                              width: '100%',
                              fontFamily: 'monospace',
                              fontSize: '0.9rem',
                              padding: '12px',
                              border: '1px solid #ccc',
                              borderRadius: '4px',
                              backgroundColor: '#f5f5f5'
                            }}
                          />
                          {issueForm.formState.errors.claims && (
                            <Typography variant="caption" color="error">
                              {issueForm.formState.errors.claims.message}
                            </Typography>
                          )}
                        </Box>
                      )}
                    />

                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={loading || !isConnected}
                      startIcon={loading ? <CircularProgress size={20} /> : <VerifiedUser />}
                      sx={{ mt: 3 }}
                    >
                      Issue Credential
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Credential Templates
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Click to use a template:
                  </Typography>
                  
                  {templatesLoading ? (
                    <Box display="flex" justifyContent="center" p={3}>
                      <CircularProgress size={30} />
                    </Box>
                  ) : (
                    templates.map((template) => (
                      <Paper
                        key={template.id}
                        sx={{ p: 2, mb: 2, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        onClick={() => useTemplate(template)}
                      >
                        <Box display="flex" alignItems="center" mb={1}>
                          {getCredentialIcon(template.id)}
                          <Typography variant="subtitle2" sx={{ ml: 1 }}>
                            {template.name}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {Object.keys(template.claims).join(', ')}
                        </Typography>
                      </Paper>
                    ))
                  )}
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Verify Credential Tab */}
        {activeTab === 'verify' && (
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Verify Credential
                </Typography>
                
                <form onSubmit={verifyForm.handleSubmit(handleVerifyCredential)}>
                  <Controller
                    name="credentialId"
                    control={verifyForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Credential ID"
                        placeholder="Enter credential ID to verify"
                        fullWidth
                        margin="normal"
                        error={!!verifyForm.formState.errors.credentialId}
                        helperText={verifyForm.formState.errors.credentialId?.message}
                      />
                    )}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
                    sx={{ mt: 2 }}
                  >
                    Verify Credential
                  </Button>
                </form>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Results */}
        {result && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={3}>
                  {result.valid ? (
                    <CheckCircle sx={{ mr: 1, color: 'success.main' }} />
                  ) : (
                    <Error sx={{ mr: 1, color: 'error.main' }} />
                  )}
                  <Typography variant="h6" color={result.valid ? 'success.main' : 'error.main'}>
                    {activeTab === 'issue' ? 'Credential Issued' : 'Verification Result'}
                  </Typography>
                </Box>

                {activeTab === 'issue' && result.credential && (
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Credential ID
                        </Typography>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                            {result.credential.id}
                          </Typography>
                          <Tooltip title="Copy Credential ID">
                            <IconButton size="small" onClick={() => copyToClipboard(result.credential.id)}>
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Transaction Hash
                        </Typography>
                        <Box display="flex" alignItems="center">
                          <Typography variant="body1" sx={{ fontFamily: 'monospace', mr: 1 }}>
                            {result.transaction?.hash}
                          </Typography>
                          <Tooltip title="Copy Transaction Hash">
                            <IconButton size="small" onClick={() => copyToClipboard(result.transaction?.hash)}>
                              <ContentCopy fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                )}

                {activeTab === 'verify' && (
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Verification Status
                        </Typography>
                        <Chip 
                          label={result.valid ? 'Valid' : 'Invalid'}
                          color={result.valid ? 'success' : 'error'}
                          size="small"
                        />
                      </Paper>
                    </Grid>

                    {result.verifiedAt && (
                      <Grid item xs={12} md={6}>
                        <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Verified At
                          </Typography>
                          <Typography variant="body1">
                            {new Date(result.verifiedAt).toLocaleString()}
                          </Typography>
                        </Paper>
                      </Grid>
                    )}
                  </Grid>
                )}

                <Divider sx={{ my: 3 }} />

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    <Info sx={{ verticalAlign: 'middle', mr: 1 }} />
                    {activeTab === 'issue' ? 'Issued Credential Details' : 'Verification Details'}
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                    <Grid container spacing={2}>
                      {Object.entries(result.credential || result).map(([key, value]) => {
                        if (key === 'id' || key === 'valid' || key === 'transaction' || key === 'verifiedAt') return null; // Already shown
                        
                        const isObject = typeof value === 'object' && value !== null;
                        const displayKey = key.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
                        
                        return (
                          <Grid item xs={12} key={key}>
                            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                                {displayKey}
                              </Typography>
                              
                              {isObject ? (
                                <Grid container spacing={2}>
                                  {Object.entries(value).map(([subKey, subValue]) => (
                                    <Grid item xs={12} sm={6} md={4} key={subKey}>
                                      <Box sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 'bold', textTransform: 'uppercase' }}>
                                          {subKey.replace(/([A-Z])/g, ' $1').trim()}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                                          {String(subValue)}
                                        </Typography>
                                      </Box>
                                    </Grid>
                                  ))}
                                </Grid>
                              ) : (
                                <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                                  {String(value)}
                                </Typography>
                              )}
                            </Box>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Error Display */}
        {error && (
          <Grid item xs={12}>
            <ErrorDisplay 
              error={error} 
              onClose={() => setError(null)} 
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Credentials;
