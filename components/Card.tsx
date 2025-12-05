import React from 'react';
import { View, Pressable, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

const Card: React.FC<CardProps> = ({ children, className = '', noPadding = false, onPress, style }) => {
  const baseStyles = 'bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden';
  const paddingStyle = noPadding ? '' : 'p-4';

  if (onPress) {
    return (
      <Pressable
        className={`${baseStyles} ${className}`}
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }, style]}
      >
        <View className={paddingStyle}>{children}</View>
      </Pressable>
    );
  }

  return (
    <View className={`${baseStyles} ${className}`} style={style}>
      <View className={paddingStyle}>{children}</View>
    </View>
  );
};

export default Card;
