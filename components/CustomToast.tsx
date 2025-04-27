import { View, Text, StyleSheet } from 'react-native';

export default function CustomToast({ text1 }: { text1?: string }) {
  return (
    <View style={styles.toastContainer}>
      <Text style={styles.toastText}>{text1}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
    alignSelf: 'center',
    marginBottom: 50,
  },
  toastText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
