import React, { useState, useMemo } from 'react';
import {
  Alert,
  AlertTitle,
  Collapse,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
  Chip,
  Divider
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Lightbulb,
  BugReport,
  Info
} from '@mui/icons-material';

const ErrorDisplay = React.memo(({ error, onClose, severity = 'error' }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!error) return null;
  
  // Memoize error info to prevent recalculations
  const memoizedErrorInfo = useMemo(() => ({ ...error }), [error]);
  
  const errorInfo = error;
  const hasSuggestions = errorInfo.suggestions && errorInfo.suggestions.length > 0;
  const hasTechnicalDetails = errorInfo.technicalDetails;
  
  return (
    <Alert
      severity={severity}
      onClose={onClose}
      sx={{ mb: 2 }}
      role="alert"
      aria-live="assertive"
      action={
        <Box>
          {hasSuggestions && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Hide suggestions' : 'Show suggestions'}
              aria-expanded={expanded}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>
      }
    >
      <AlertTitle>{errorInfo.title || 'Error'}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {errorInfo.message || 'An error occurred'}
      </Typography>
      
      <Collapse in={expanded}>
        {hasSuggestions && (
          <Box sx={{ mt: 2 }} role="region" aria-label="Suggestions">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Lightbulb sx={{ mr: 1, fontSize: 16, color: 'warning.main' }} aria-hidden="true" />
              <Typography variant="subtitle2" fontWeight="bold">
                What you can do:
              </Typography>
            </Box>
            <List dense sx={{ pl: 2 }} aria-label="Suggestion list">
              {errorInfo.suggestions.map((suggestion, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={
                      <Typography variant="body2">
                        • {suggestion}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        {hasTechnicalDetails && (
          <Box sx={{ mt: 2 }} role="region" aria-label="Technical details">
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <BugReport sx={{ mr: 1, fontSize: 16, color: 'info.main' }} aria-hidden="true" />
              <Typography variant="subtitle2" fontWeight="bold">
                Technical Details:
              </Typography>
            </Box>
            
            {errorInfo.technicalDetails.code && (
              <Box sx={{ mb: 1 }}>
                <Chip 
                  label={`Code: ${errorInfo.technicalDetails.code}`}
                  size="small"
                  variant="outlined"
                  sx={{ mr: 1 }}
                  aria-label={`Error code: ${errorInfo.technicalDetails.code}`}
                />
              </Box>
            )}
            
            {errorInfo.technicalDetails.originalMessage && (
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }} aria-label="Original error message">
                {errorInfo.technicalDetails.originalMessage}
              </Typography>
            )}
            
            {errorInfo.technicalDetails.stack && (
              <Box sx={{ mt: 1 }} aria-label="Error stack trace">
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {errorInfo.technicalDetails.stack}
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Alert>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  // Return true if props are equal (skip re-render)
  return (
    prevProps.severity === nextProps.severity &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.error?.message === nextProps.error?.message &&
    JSON.stringify(prevProps.error?.suggestions) === JSON.stringify(nextProps.error?.suggestions)
  );
});

ErrorDisplay.displayName = 'ErrorDisplay';

export default ErrorDisplay;
