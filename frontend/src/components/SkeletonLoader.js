import React from 'react';
import { Box, Skeleton, Grid, Card, CardContent } from '@mui/material';

export const DashboardSkeleton = () => (
  <Box>
    <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
    <Grid container spacing={3}>
      {[...Array(4)].map((_, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="60%" height={24} />
              <Skeleton variant="text" width="40%" height={32} sx={{ mt: 1 }} />
              <Skeleton variant="rectangular" width="100%" height={4} sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
    <Box sx={{ mt: 4 }}>
      <Skeleton variant="text" width={300} height={32} sx={{ mb: 2 }} />
      <Grid container spacing={2}>
        {[...Array(3)].map((_, index) => (
          <Grid item xs={12} md={4} key={index}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="80%" height={20} />
                <Skeleton variant="text" width="60%" height={16} sx={{ mt: 1 }} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  </Box>
);

export const CredentialCardSkeleton = () => (
  <Card sx={{ mb: 2 }}>
    <CardContent>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" flex={1}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box ml={2} flex={1}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={16} sx={{ mt: 0.5 }} />
          </Box>
        </Box>
        <Skeleton variant="rectangular" width={80} height={24} />
      </Box>
      
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Skeleton variant="text" width="30%" height={16} />
          <Skeleton variant="text" width="90%" height={16} sx={{ mt: 0.5 }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Skeleton variant="text" width="30%" height={16} />
          <Skeleton variant="text" width="85%" height={16} sx={{ mt: 0.5 }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Skeleton variant="text" width="30%" height={16} />
          <Skeleton variant="text" width="50%" height={16} sx={{ mt: 0.5 }} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <Skeleton variant="text" width="30%" height={16} />
          <Skeleton variant="text" width="45%" height={16} sx={{ mt: 0.5 }} />
        </Grid>
      </Grid>
      
      <Box display="flex" justifyContent="flex-end" mt={2} gap={1}>
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="circular" width={32} height={32} />
      </Box>
    </CardContent>
  </Card>
);

export const CredentialListSkeleton = () => (
  <Box>
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
      <Skeleton variant="text" width={200} height={32} />
      <Box display="flex" gap={2}>
        <Skeleton variant="rectangular" width={200} height={40} />
        <Skeleton variant="rectangular" width={120} height={40} />
        <Skeleton variant="circular" width={40} height={40} />
      </Box>
    </Box>
    
    <Box display="flex" gap={2} mb={3}>
      <Skeleton variant="rectangular" width={150} height={40} />
      <Skeleton variant="rectangular" width={150} height={40} />
      <Skeleton variant="rectangular" width={150} height={40} />
      <Skeleton variant="rectangular" width={150} height={40} />
      <Skeleton variant="rectangular" width={150} height={40} />
    </Box>
    
    {[...Array(5)].map((_, index) => (
      <CredentialCardSkeleton key={index} />
    ))}
    
    <Box display="flex" justifyContent="center" mt={3}>
      <Skeleton variant="rectangular" width={300} height={40} />
    </Box>
  </Box>
);

export const FormSkeleton = () => (
  <Card>
    <CardContent>
      <Skeleton variant="text" width="40%" height={28} sx={{ mb: 3 }} />
      {[...Array(4)].map((_, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Skeleton variant="text" width="20%" height={16} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" width="100%" height={56} />
        </Box>
      ))}
      <Box display="flex" gap={2} mt={3}>
        <Skeleton variant="rectangular" width={120} height={40} />
        <Skeleton variant="rectangular" width={100} height={40} />
      </Box>
    </CardContent>
  </Card>
);

export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <Box>
    <Box sx={{ mb: 2 }}>
      <Skeleton variant="text" width={200} height={32} />
    </Box>
    {[...Array(rows)].map((_, rowIndex) => (
      <Box key={rowIndex} sx={{ mb: 1, p: 2, border: '1px solid #f0f0f0', borderRadius: 1 }}>
        <Box display="flex" gap={2}>
          {[...Array(columns)].map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" width={`${100 / columns}%`} height={20} />
          ))}
        </Box>
      </Box>
    ))}
  </Box>
);

export default {
  DashboardSkeleton,
  CredentialCardSkeleton,
  CredentialListSkeleton,
  FormSkeleton,
  TableSkeleton
};
