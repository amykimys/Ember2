import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#fff',
      paddingTop: 15,
      paddingHorizontal: 20,
      paddingBottom: 30,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    menuButton: {
      padding: 4,
      marginBottom: 45,
      marginTop: 0,
    },
    menuIcon: {
      marginTop: 10,
      paddingVertical: 10,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#1a1a1a',
    },
    dateNavigation: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 0,
      marginBottom: 24,
    },
    dateNavigationButton: {
      padding: 8,
    },
    dateHeader: {
      alignItems: 'center',
    },
    dateText: {
      fontSize: 26,
      color: '#666',
      fontWeight: 'bold',
      letterSpacing: 1.2,
    },
    relativeDayText: {
      fontSize: 16,
      color: '#007AFF',
      fontWeight: 'normal',
      marginTop: 5,
    },
    todayText: {
      fontSize: 12,
      color: '#007AFF',
      marginTop: 4,
    },
    todoList: {
      flex: 1,
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
    },
    emptyStateSubtitle: {
      fontSize: 18,
      color: '#666',
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
      fontSize: 14,
      fontWeight: '600',
      color: '#666',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    categoryContent: {
      borderRadius: 12,
      overflow: 'hidden',
      marginTop: 3,
    },
    todoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 0,
      overflow: 'hidden', // or your base bg
      borderRadius: 0,         // optional, but won't hurt
      
    },
    todoContent: {
      flex: 1,
    },
    completedTodo: {
      opacity: 0.6,
    },
    checkbox: {
      width: 12,
      height: 12,
      borderRadius: 9,
      borderWidth: 1.5,
      borderColor: '#34D399',
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checked: {
      backgroundColor: '#34D399',
    },
    todoText: {
      fontSize: 18,
      color: '#1a1a1a',
    },
    todoDescription: {
      fontSize: 14,
      color: '#666',
      marginTop: 4,
    },
    completedText: {
      textDecorationLine: 'line-through',
    },
    repeatIndicator: {
      fontSize: 12,
      color: '#666',
      marginTop: 4,
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
      backgroundColor: '#007AFF',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    bottomSheet: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      width: '100%',          // ⬅️ full width
      marginHorizontal: 0,    // ⬅️ no side margins
      overflow: 'hidden',     // optional, makes it clean
    },

    dimBackground: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',  // semi-transparent black
      zIndex: 1,
    },    
    
    bottomSheetIndicator: {
      backgroundColor: '#E0E0E0',
      width: 40,
      height: 4,
      borderRadius: 2,
      marginTop: 8,
    },
    keyboardAvoidingView: {
      flex: 1,
    },
    bottomSheetScrollView: {
      flex: 1,
    },
    bottomSheetScrollContent: {
      paddingBottom: 24,
    },
    bottomSheetContent: {
      padding: 20,
    },
    bottomSheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    bottomSheetTitle: {
      fontSize: 25,
      fontWeight: 'bold',
      color: '#1a1a1a',
    },
    input: {
      fontSize: 18,
      color: '#1a1a1a',
      padding: 12,
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      marginBottom: 16,
    },
    descriptionInput: {
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 20,
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
    },
    categorySection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1a1a1a',
      marginBottom: 12,
    },
    categoryButtons: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 0,
    borderRadius: 20,
    alignItems: 'center', 
    justifyContent: 'center', 
    minWidth: 40, 
  },
  
    selectedCategoryButton: {
      borderWidth: 2,
      borderColor: '#007AFF',
    },
    categoryButtonText: {
      fontSize: 12,
      color: '#1a1a1a',
      letterSpacing: 0.6,  
      fontWeight: '500',
    },
    newCategoryButton: {
      width: 34,
      height: 34,
      borderRadius: 20,
      backgroundColor: '#F5F5F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    newCategoryForm: {
      gap: 0,
      marginTop: 16,
    },
    colorPicker: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    colorOption: {
      width: 24,
      height: 24,
      borderRadius: 12,
      marginRight: 8,
    },
    selectedColor: {
      borderWidth: 2,
      borderColor: '#007AFF',
    },
    newCategoryActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    cancelCategoryButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    cancelCategoryText: {
      fontSize: 16,
      color: '#666',
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      flex: 1,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: '#F5F5F5',
    },
    saveButton: {
      backgroundColor: '#007AFF',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#666',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    modal: {
      margin: 0,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: '#fff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#1a1a1a',
    },
    webDatePicker: {
      fontSize: 16,
      padding: 8,
      borderWidth: 1,
      borderColor: '#E0E0E0',
      borderRadius: 8,
    },
    repeatOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    selectedRepeatOption: {
      backgroundColor: '#F5F5F5',
    },
    repeatOptionText: {
      fontSize: 16,
      color: '#1a1a1a',
    },
    selectedRepeatOptionText: {
      fontWeight: '600',
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
    },
    weekDaysContainer: {
      gap: 12,
    },
    weekDaysTitle: {
      fontSize: 16,
      color: '#1a1a1a',
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
    },
    selectedWeekDayButtonText: {
      color: '#fff',
    },
    doneButton: {
      height: 48,
      borderRadius: 24,
      backgroundColor: '#007AFF',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    doneButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    swipeActionContainer: {
    backgroundColor: '#FF3B30',  // 🔥 RED instead of blue
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 20,
    width: 100,
  },
    swipeActionText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,  // even spacing between rows
    },
    
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1a1a1a',
      width: 80,   // fixed width so all labels line up
    },
    
    newOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F5F5F5',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      flex: 1,
      justifyContent: 'space-between',
    },
    
    newOptionText: {
      fontSize: 16,
      color: '#333',
      marginLeft: 12,  // nice space between icon and text
      flex: 1,
    },
    rightAction: {
      backgroundColor: '#FF3B30',
      justifyContent: 'center',
      alignItems: 'center',
      width: 64,
      flex: 1, // ✅ fill parent height
      borderRadius: 10,
    },
    
    trashIconContainer: {
      padding: 12,
    },
    
    
  });

export default styles;