frappe.pages['weekly-timesheet'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Weekly Timesheet',
		single_column: true
	});

	// page.main.addClass('frappe-card');

	// Initialize the weekly timesheet
	frappe.weekly_timesheet = new WeeklyTimesheet(page);
	// Set it inside a div
}
