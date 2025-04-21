import { StyleSheet } from 'react-native';

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
      paddingHorizontal: 20,
      marginBottom: 65,
    },
    menuButton: {
      padding: 4,
    },
    title: {
      fontSize: 23,
      fontWeight: 'bold',
      color: '#1a1a1a',
    },
    habitList: {
      flex: 1,
      paddingHorizontal: 20,
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
      marginTop: 170,
    },
    emptyStateSubtitle: {
      fontSize: 18,
      color: '#666',
    },
    habitItem: {
      padding: 15,
      borderRadius: 10,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    habitHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      marginTop: -6,
    },
    habitName: {
      fontSize: 16,
      fontWeight: '600',
    },
    habitDetails: {
      fontSize: 10,
      lineHeight: 14,
    },
    streakText: {
      fontSize: 14.5,
      fontWeight: '600',
      color: '#1a1a1a',
      marginLeft: -3
    },
    checkmarksContainer: {
      flexDirection: 'row',
      gap: 3, // 👈 Increase this for more space between checkmarks
      flex: 1,
      justifyContent: 'flex-end',
    },   
    weekHeaderContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      //can make weekdates more inside
      paddingHorizontal: 24,
      marginBottom: 15,
    },
    monthText: {
      fontSize: 18,
      fontWeight: '600',
      color: '#1a1a1a',
      width: 90,
    },
    weekHeaderDates: {
      flexDirection: 'row',
      gap: 5,
      flex: 1,
      justifyContent: 'flex-end',
    },
    addButton: {
      position: 'absolute',
      right: 28,
      bottom: 85,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: '#007AFF',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
   deleteButton: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginVertical: 10,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
    rightAction: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderRadius: 10,
    marginBottom: 10,
    },
  trashIconContainer: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 30,
  },
    modalContent: {
      backgroundColor: '#fff',
      borderTopLeftRadius: 15,
      borderTopRightRadius: 15,
      padding: 20,
      maxHeight: '90%',
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
    input: {
      fontSize: 14,
      color: '#1a1a1a',
      padding: 12,
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      marginBottom: 16,
    },
    descriptionInput: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    optionContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    optionLabel: {
      fontSize: 15,
      color: '#1a1a1a',
      fontWeight: 'bold',
    },
    repeatSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#1a1a1a',
      marginBottom: 12,
    },
    repeatTypeContainer: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    repeatTypeButton: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      backgroundColor: '#F5F5F5',
      alignItems: 'center',
    },
    selectedRepeatType: {
      backgroundColor: '#007AFF',
    },
    repeatTypeText: {
      fontSize: 12,
      fontWeight: 'bold',
    },
    weekDaysContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    weekDayButton: {
      flex: 1,
      height: 32,
      borderRadius: 25,
      backgroundColor: '#F5F5F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedWeekDay: {
      backgroundColor: '#007AFF',
    },
    weekDayText: {
      fontSize: 13,
      color: '#1a1a1a',
    },
    selectedWeekDayText: {
      color: '#fff',
    },
    frequencyContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    frequencyLabel: {
      fontSize: 16,
      color: '#1a1a1a',
    },
    frequencyInput: {
      width: 60,
      fontSize: 16,
      color: '#1a1a1a',
      padding: 8,
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      textAlign: 'center',
    },
    colorSection: {
      marginBottom: 24,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    colorOption: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedColorOption: {
      borderColor: '#007AFF',
    },
    editButton: {
      backgroundColor: '#007AFF',
      justifyContent: 'center',
      alignItems: 'center',
      width: 56,
      marginVertical: 10,
      borderRadius: 8,
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
    photoModalContent: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 20,
    },
    photoOptions: {
      marginTop: 20,
      gap: 16,
    },
    photoOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: '#F5F5F5',
      borderRadius: 12,
    },
    photoOptionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    photoOptionText: {
      fontSize: 16,
      color: '#1a1a1a',
      fontWeight: '500',
    },
    photoPreviewContent: {
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 20,
    },
    previewImage: {
      width: '100%',
      height: 300,
      borderRadius: 12,
      marginTop: 16,
    },
    photoIndicator: {
      position: 'absolute',
      bottom: -8,
      right: -8,
      backgroundColor: '#fff',
      borderRadius: 8,
      padding: 2,
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    photoRequired: {
      borderStyle: 'dashed',
    },
    dayColumn: {
      alignItems: 'center',
      width: 30,
    },
    dayAbbreviation: {
      fontSize: 14,
      color: '#666',
      marginBottom: 4,
      paddingRight: 18,
    },
    dateNumber: {
      fontSize: 14,
      color: '#666',
      paddingRight: 30,
    },
    //open circle
    openCircle: {
      width: 11,
      height: 11,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: 'black',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 2, 
    },
    dayCell: {
      width: `${100 / 7}%`,
      alignItems: 'flex-start', // left-align text
      justifyContent: 'center',
        },
    
    checkboxButtonCompleted: {
      borderWidth: 0, // hide border
      alignItems: 'center',
      justifyContent: 'center',      
    },
    
    reminderButton: {
      paddingVertical: 10,
      paddingHorizontal: 15,
      backgroundColor: '#F0F0F0',
      borderRadius: 8,
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    
    reminderText: {
      fontSize: 16,
      color: '#1a1a1a',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
    },
    
    newOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#F3F4F6',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    
    newOptionText: {
      fontSize: 16,
      color: '#1a1a1a',
    },

    bottomSheet: {
      backgroundColor: 'white',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      width: '100%',          // ⬅️ full width
      marginHorizontal: 0,    // ⬅️ no side margins
      overflow: 'hidden',     // optional, makes it clean
    },
    categorySection: {
      marginBottom: 24,
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
    toggleButton: {
      flex: 1,
      paddingVertical: 10,
      backgroundColor: '#eee',
      borderRadius: 10,
      marginHorizontal: 5,
      alignItems: 'center',
    },
    toggleButtonActive: {
      backgroundColor: '#007AFF',
    },
    toggleButtonText: {
      color: '#333',
      fontWeight: '600',
    },
    dayToggle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      marginHorizontal: 6,
      marginVertical: 6,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#E0E0E0',
    },
    
    dayToggleSelected: {
      backgroundColor: '#007AFF',
    },
    
    dayToggleText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#333',
    },

    checkmarkAlone: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      // no border or background
    },

    dayIndicatorWrapper: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      //move to the items to the right
      paddingLeft: 8,
    },
    
    dayIndicatorTouchable: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    grayDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#999',
    },

    circleBase: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
  
    
  });

  export default styles;