import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { PRIMARY } from '../constants/colors';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  onPress?: () => void;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  onPress,
  className = '',
}) => {
  const baseStyles = 'flex-row items-center justify-center rounded-2xl py-4 px-6';
  
  const variants = {
    primary: 'bg-primary-700 shadow-lg',
    secondary: 'bg-white border border-gray-200 shadow-sm',
    outline: 'bg-transparent border-2 border-primary-600',
    ghost: 'bg-transparent',
  };

  const textVariants = {
    primary: 'text-white font-semibold',
    secondary: 'text-gray-900 font-semibold',
    outline: 'text-primary-600 font-semibold',
    ghost: 'text-gray-600 font-semibold',
  };

  const widthStyle = fullWidth ? 'w-full' : '';
  const disabledStyle = disabled || loading ? 'opacity-50' : '';

  return (
    <TouchableOpacity
      className={`${baseStyles} ${variants[variant]} ${widthStyle} ${disabledStyle} ${className}`}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? '#fff' : PRIMARY} />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View className="mr-2">{icon}</View>}
          <Text className={`text-base ${textVariants[variant]}`}>{children}</Text>
          {icon && iconPosition === 'right' && <View className="ml-2">{icon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;
