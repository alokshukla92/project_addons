# Project Addons

Custom Frappe app with enhanced project management features, including a modern weekly timesheet interface inspired by Keka's UX design.

## Features

### Weekly Timesheet (Keka-style Interface)
- **Modern Grid Interface**: Clean, tabular view showing all days of the week
- **Week Navigation**: Easy navigation between weeks with calendar picker  
- **Project/Task Selection**: Dropdown selection for projects and activity types
- **Real-time Calculations**: Automatic calculation of daily, weekly, billable, and non-billable hours
- **Integrated Data**: Fully integrated with Frappe's existing Timesheet doctype
- **Status Indicators**: Visual indicators for billable/non-billable time and submission status
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Key Improvements over Standard Frappe Timesheet
1. **Better UX**: Week-at-a-glance view instead of line-by-line entry
2. **Intuitive Navigation**: Calendar-based week selection
3. **Visual Feedback**: Color-coded status indicators and real-time totals
4. **Efficient Data Entry**: Quick time entry with smart parsing (supports formats like "1:30", "1.5", etc.)
5. **Integrated Actions**: Save, submit, copy previous week, and apply leave functionality

## Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench install-app project_addons
bench build
bench restart
```

## Usage

### Accessing Weekly Timesheet
1. Go to the **Timesheet Management** workspace
2. Click on **Weekly Timesheet** 
3. Or directly navigate to: `your-site/app/weekly-timesheet`

### Using the Interface

#### Week Navigation
- Use the **Week Starting** date picker to navigate between weeks
- The interface automatically calculates the full week (Monday to Sunday)

#### Adding Time Entries
1. Click **Add Task** button to add a new row
2. Select a project or activity type from the dropdown
3. Enter hours for each day using formats like:
   - `1:30` (1 hour 30 minutes)
   - `1.5` (1.5 hours)
   - `90` (90 minutes, converted to 1.5 hours)
4. Add notes in the NOTE field if needed
5. Time totals are calculated automatically

#### Saving & Submitting
- **Save Draft**: Saves timesheet as draft for later completion
- **Submit Timesheet**: Submits timesheet for approval
- **Copy Previous Week**: Copies entries from the previous week (coming soon)
- **Apply Leave**: Integrates with leave application (coming soon)

#### Status Indicators
- 🟢 **Green Indicator**: Billable hours
- 🟠 **Orange Indicator**: Non-billable hours  
- **Submitted Days**: Shown with checkmarks
- **Draft Days**: Shown with pencil icons

## Technical Details

### API Endpoints
- `get_weekly_timesheet_data`: Fetches weekly timesheet data
- `save_weekly_timesheet`: Saves/updates timesheet entries
- `get_tasks_for_project`: Fetches tasks for selected project
- `get_activity_cost`: Retrieves billing/costing rates

### File Structure
```
project_addons/
├── project_addons/
│   ├── api/
│   │   └── timesheet.py              # API endpoints
│   └── page/
│       └── weekly_timesheet/         # Page configuration
└── public/
    ├── css/
    │   └── weekly_timesheet.css      # Styling
    └── js/
        └── timesheet/
            └── weekly_timesheet.js   # Main JavaScript class
```

### Integration with Frappe
- Fully compatible with existing Frappe Timesheet doctype
- Respects user permissions and role-based access
- Integrates with Projects, Tasks, and Activity Types
- Supports multi-currency and exchange rates
- Compatible with existing timesheet reports and workflows

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/project_addons
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

mit
