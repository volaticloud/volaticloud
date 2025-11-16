import { Box, Typography } from '@mui/material';
import { SmartToy as BotIcon } from '@mui/icons-material';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
}

export const Logo = ({ variant = 'full', size = 'medium', onClick }: LogoProps) => {
  const iconSizes = {
    small: 24,
    medium: 32,
    large: 40,
  };

  const textSizes = {
    small: 'h6',
    medium: 'h6',
    large: 'h5',
  } as const;

  if (variant === 'icon') {
    return (
      <BotIcon
        sx={{
          color: 'primary.main',
          fontSize: iconSizes[size],
          cursor: onClick ? 'pointer' : 'default',
        }}
        onClick={onClick}
      />
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <BotIcon
        sx={{
          color: 'primary.main',
          fontSize: iconSizes[size],
        }}
      />
      <Typography
        variant={textSizes[size]}
        noWrap
        component="div"
        fontWeight={700}
        sx={{
          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        VolatiCloud
      </Typography>
    </Box>
  );
};
