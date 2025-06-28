import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      paddingTop: 15,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 42,
    },
    menuButton: {
      padding: 4,
      
    },
    todoList: {
      flex: 1,
      paddingHorizontal: 12,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 300,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#3A3A3A',
      textAlign: 'center',
    },
    emptyStateSubtitle: {
      fontSize: 18,
      color: '#666',
      textAlign: 'center',
    },
    categoryContainer: {
      marginBottom: 26,
    },
    categoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 0,
    },
    categoryTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: '#3a3a3a',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginHorizontal: 10,
      paddingBottom: 4,
      fontFamily: 'Onest',
    },
    categoryContent: {
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 5,
      marginHorizontal: 5,
    },
    todoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 0,
      overflow: 'hidden', // or your base bg
      borderRadius: 0,         // optional, but won't hurt
      
    },
    todoContent: {
      flex: 1,
      paddingHorizontal: 2,
    },
    completedTodo: {
      opacity: 0.6,
      backgroundColor: '#F5F5F5',
    },
    todoText: {
      fontSize: 15,
      color: '#1a1a1a',
      fontFamily: 'Onest',
    },
    todoDescription: {
      fontSize: 12,
      color: '#666',
      marginTop: 4,
      fontFamily: 'Onest',
    },
    completedText: {
      textDecorationLine: 'line-through',
      color: '#666',
      fontFamily: 'Onest',
    },
    completedDescription: {
      textDecorationLine: 'line-through',
      color: '#666',
      fontFamily: 'Onest',
    },
    completedSection: {
      marginTop: 24,
    },
    addButton: {
      position: 'absolute',
      right: 24,
      bottom: 100,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#667eea',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    
    modalContent: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
      paddingTop: 8
    },
    
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1a1a1a',
    },
   
    rightAction: {
      backgroundColor: '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      width: 64,
      flex: 1, // ✅ fill parent height
      borderRadius: 0,
    },
    
    leftAction: {
      backgroundColor: '#667eea',
      justifyContent: 'center',
      alignItems: 'center',
      width: 64,
      flex: 1, // ✅ fill parent height
      borderRadius: 0,
    },
    
    trashIconContainer: {
      padding: 9,
    },

    photoIconContainer: {
      padding: 12,
      justifyContent: 'center',
      alignItems: 'center',
      minWidth: 44,
      minHeight: 44,
    },

    stickyFooter: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingTop: 0,
      backgroundColor: 'white',
      borderTopColor: '#eee',
    },
    doneButton: {
      marginBottom: 35,
      backgroundColor: '#FFB6B9',
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    doneText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
      fontFamily: 'Onest',
    },
    // Add modal styles to match event modal
    modalTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    modalLabel: {
      fontSize: 14,
      color: '#333',
      fontFamily: 'Onest',
      fontWeight: '500',
    },
    modalTimeButton: {
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: '#f0f0f0',
    },
    modalTimeButtonFocused: {
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: '#667eea',
    },
    modalTimeText: {
      fontSize: 14,
      color: '#333',
      fontFamily: 'Onest',
      fontWeight: '500',
    },
    modalPickerContainer: {
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      padding: 8,
      marginTop: 4,
      borderWidth: 1,
      borderColor: '#e0e0e0',
    },
  });

export default styles;