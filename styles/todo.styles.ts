import { StyleSheet, Platform } from 'react-native';

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      paddingTop: 5,
      paddingHorizontal: 14,
      paddingBottom: 30,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 15,
      marginBottom: 0,
    },
    menuButton: {
      padding: 0,
      marginBottom: 40,
      marginTop: 20,
    },

    todoList: {
      flex: 1,
      paddingTop: 0, 
      marginTop: -13,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 300,
    },
    emptyStateTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1a1a1a',
      marginBottom: 8,
      marginTop: 150,
      fontFamily: 'Onest',
    },
    emptyStateSubtitle: {
      fontSize: 17,
      color: '#666',
      fontFamily: 'Onest',
    },
    categoryContainer: {
      marginBottom: 20,
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
      color: 'black',
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
      padding: 11,
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
      right: 10,
      bottom: 50,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#A0C3B2',
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
      paddingBottom: 0,
    },
    
    modalContent: {
      backgroundColor: 'white',
      padding: 0,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1a1a1a',
      fontFamily: 'Onest',
    },
   
    rightAction: {
      backgroundColor: '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      width: 64,
      flex: 1, // ✅ fill parent height
      borderRadius: 0,
    },
    
    trashIconContainer: {
      padding: 9,
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
      marginBottom: 30,
      backgroundColor: '#FFB6B9',
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    doneText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    
  });

export default styles;