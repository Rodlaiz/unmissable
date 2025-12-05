import React from 'react';
import { View, TextInput, Text, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, icon, error, className = '', ...props }) => {
  return (
    <View className={`w-full ${className}`}>
      {label && <Text className="text-sm font-medium text-gray-700 mb-1.5">{label}</Text>}
      <View className="relative">
        {icon && (
          <View className="absolute left-3 top-0 bottom-0 justify-center z-10">
            {icon}
          </View>
        )}
        <TextInput
          className={`
            w-full rounded-xl border border-gray-200 bg-white
            ${icon ? 'pl-10' : 'pl-4'} pr-4 py-3
            text-gray-900 text-base
          `}
          placeholderTextColor="#9ca3af"
          {...props}
        />
      </View>
      {error && <Text className="mt-1 text-sm text-red-500">{error}</Text>}
    </View>
  );
};

export default Input;
