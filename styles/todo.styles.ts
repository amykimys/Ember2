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
    title: {
      fontSize: 25,
      fontWeight: 'bold',
      color: '#1a1a1a',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    dateText: {
      fontSize: 26,
      color: '#666',
      fontWeight: 'bold',
      letterSpacing: 1.2,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    relativeDayText: {
      fontSize: 16,
      color: '#007AFF',
      fontWeight: 'normal',
      marginTop: 5,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
      fontSize: 24,
      fontWeight: 'bold',
      color: '#1a1a1a',
      marginBottom: 8,
      marginTop: 150,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    emptyStateSubtitle: {
      fontSize: 18,
      color: '#666',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    todoDescription: {
      fontSize: 12,
      color: '#666',
      marginTop: 4,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    completedText: {
      textDecorationLine: 'line-through',
      color: '#666',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    completedDescription: {
      textDecorationLine: 'line-through',
      color: '#666',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
      backgroundColor: '#6F4E37',
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
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      marginBottom: 16,
    },
    optionText: {
      fontSize: 16,
      color: '#666',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
   
    customRepeatContainer: {
      marginTop: 16,
      gap: 16,
    },
    customRepeatInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    everyText: {
      fontSize: 16,
      color: '#1a1a1a',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    customRepeatInput: {
      width: 60,
      fontSize: 16,
      color: '#1a1a1a',
      padding: 8,
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      textAlign: 'center',
    },
    unitSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    unitSelectorText: {
      fontSize: 16,
      color: '#1a1a1a',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    weekDaysContainer: {
      gap: 12,
    },
    weekDaysTitle: {
      fontSize: 14,
      color: '#1a1a1a',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    weekDayButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    weekDayButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#F5F5F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedWeekDayButton: {
      backgroundColor: '#007AFF',
    },
    weekDayButtonText: {
      fontSize: 14,
      color: '#1a1a1a',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    selectedWeekDayButtonText: {
      color: '#fff',
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
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
    
  });

export default styles;