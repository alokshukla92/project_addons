# Weekly Timesheet Testing Guide

## Pre-requisites
1. Ensure you have an Employee record linked to your user account
2. Have at least one Project with status "Open"
3. Have at least one Activity Type configured

## Testing Steps

### 1. Access the Page
- Navigate to **Timesheet Management** workspace
- Click on **Weekly Timesheet**
- Or go directly to: `your-site/app/weekly-timesheet`

### 2. Basic Functionality Tests

#### Week Navigation
- [ ] Week Starting date picker should default to current week (Monday)
- [ ] Changing the week should reload the timesheet data
- [ ] Week should display Monday to Sunday columns

#### Employee Selection (HR Manager/System Manager only)
- [ ] Employee dropdown should be visible for HR roles
- [ ] Should populate with active employees
- [ ] Changing employee should reload data for that employee

#### Grid Interface
- [ ] Should display proper week summary with billable/non-billable hours
- [ ] Grid should show 7 day columns (Mon-Sun) 
- [ ] Should have "Add Task" button
- [ ] Footer should show daily and weekly totals

### 3. Data Entry Tests

#### Adding Time Entries
- [ ] Click "Add Task" to add new row
- [ ] Select Project or Activity Type from dropdown
- [ ] Enter hours in different formats:
  - `1:30` (1 hour 30 minutes)
  - `1.5` (1.5 hours)
  - `90` (should convert to 1.5 hours)
- [ ] Add notes in the NOTE field
- [ ] Verify totals update automatically

#### Time Calculations
- [ ] Row totals should calculate correctly
- [ ] Daily totals should sum all entries for each day
- [ ] Weekly total should sum all daily totals
- [ ] Billable vs non-billable hours should be tracked separately

### 4. Save and Submit Tests

#### Save Draft
- [ ] Click "Save Draft" button
- [ ] Verify success message
- [ ] Reload page and verify data persists

#### Submit Timesheet
- [ ] Click "Submit Timesheet" from menu
- [ ] Should confirm before submitting
- [ ] Verify timesheet is submitted in backend

### 5. Integration Tests

#### Frappe Timesheet Integration
- [ ] Check if entries appear in standard Timesheet doctype
- [ ] Verify employee, project, and activity associations
- [ ] Check if hours and dates are correctly mapped
- [ ] Ensure billing rates are applied correctly

#### Permissions
- [ ] Regular users should only see their own data
- [ ] HR Managers should see employee selector
- [ ] System Managers should have full access

### 6. UI/UX Tests

#### Visual Elements
- [ ] Indicators should show green for billable, orange for non-billable
- [ ] Summary cards should display proper colors and values
- [ ] Grid should be responsive on mobile devices
- [ ] Styling should match Frappe's design system

#### User Experience
- [ ] Interface should be intuitive and easy to use
- [ ] Time entry should be quick and efficient
- [ ] Navigation should be smooth between weeks
- [ ] Error messages should be clear and helpful

## Common Issues and Solutions

### Page Not Loading
- Check if app is properly installed: `bench list-apps`
- Verify assets are built: `bench build --app project_addons`
- Check browser console for JavaScript errors

### API Errors
- Verify user has Timesheet permissions
- Check Employee record exists for current user
- Ensure Projects and Activity Types are configured

### Data Not Saving
- Check database permissions
- Verify timesheet validation rules
- Check browser console for errors

## Test Data Setup

### Create Test Project
```python
# In Frappe console (bench console)
project = frappe.new_doc("Project")
project.project_name = "Test Project for Timesheet"
project.status = "Open"
project.save()
```

### Create Test Activity Type
```python
# In Frappe console
activity = frappe.new_doc("Activity Type")
activity.activity_name = "Development"
activity.billing_rate = 100
activity.costing_rate = 50
activity.save()
```

### Link User to Employee
```python
# In Frappe console
employee = frappe.get_doc("Employee", "EMP-001")  # Replace with actual employee
employee.user_id = "user@example.com"  # Replace with actual user
employee.save()
```

## Performance Tests
- [ ] Page loads within 3 seconds
- [ ] Week navigation responds instantly
- [ ] Time entry is smooth without lag
- [ ] Save operations complete within 2 seconds

## Browser Compatibility
Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers

## Reporting Bugs
When reporting issues, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors (if any)
5. Screenshots/videos if helpful

## Success Criteria
✅ All basic functionality tests pass  
✅ Data integrates correctly with Frappe Timesheet  
✅ UI matches design requirements  
✅ Performance is acceptable  
✅ No critical bugs or errors