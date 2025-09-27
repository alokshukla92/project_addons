import frappe
from frappe import _
from frappe.utils import getdate, add_days, flt
import datetime


@frappe.whitelist()
def get_weekly_timesheet_data(employee=None, start_date=None):
    """Get weekly timesheet data for the specified employee and week"""

    if not employee:
        # Get current user's employee
        employee = frappe.db.get_value(
            "Employee", {"user_id": frappe.session.user}, "name"
        )
        if not employee:
            frappe.throw(_("No employee record found for current user"))

    if not start_date:
        # Get current week start (Monday)
        today = getdate()
        start_date = today - datetime.timedelta(days=today.weekday())
    else:
        start_date = getdate(start_date)

    end_date = add_days(start_date, 6)

    # Get employee details
    employee_doc = frappe.get_doc("Employee", employee)

    # Get existing timesheets for the week
    timesheets = frappe.db.sql(
        """
        SELECT ts.name, ts.start_date, ts.end_date, ts.total_hours,
               ts.total_billable_hours, ts.status, ts.docstatus,
               tsd.activity_type, tsd.project, tsd.task, tsd.hours,
               tsd.from_time, tsd.to_time, tsd.is_billable, tsd.billing_hours,
               tsd.description, tsd.name as detail_name,
               p.project_name, t.subject as task_name,
               act.name as activity_name
        FROM `tabTimesheet` ts
        LEFT JOIN `tabTimesheet Detail` tsd ON ts.name = tsd.parent
        LEFT JOIN `tabProject` p ON tsd.project = p.name
        LEFT JOIN `tabTask` t ON tsd.task = t.name
        LEFT JOIN `tabActivity Type` act ON tsd.activity_type = act.name
        WHERE ts.employee = %s
        AND ts.start_date >= %s
        AND ts.end_date <= %s
        ORDER BY ts.start_date, tsd.from_time
    """,
        (employee, start_date, end_date),
        as_dict=True,
    )

    # Get projects accessible to employee
    projects = frappe.db.sql(
        """
        SELECT DISTINCT p.name, p.project_name, p.status
        FROM `tabProject` p
        WHERE p.status = 'Open'
        ORDER BY p.project_name
    """,
        as_dict=True,
    )

    # Get activity types
    activity_types = frappe.db.sql(
        """
        SELECT name, name as activity_name, billing_rate, costing_rate
        FROM `tabActivity Type`
        WHERE disabled = 0
        ORDER BY activity_name
    """,
        as_dict=True,
    )

    return {
        "employee": {
            "name": employee_doc.name,
            "employee_name": employee_doc.employee_name,
            "company": employee_doc.company,
            "department": employee_doc.department,
        },
        "date_range": {"start_date": start_date, "end_date": end_date},
        "timesheets": timesheets,
        "projects": projects,
        "activity_types": activity_types,
    }


@frappe.whitelist()
def get_tasks_for_project(project):
    """Get tasks for a specific project"""
    if not project:
        return []

    return frappe.db.sql(
        """
        SELECT name, subject, status, priority
        FROM `tabTask`
        WHERE project = %s
        AND status != 'Cancelled'
        ORDER BY priority DESC, subject
    """,
        (project,),
        as_dict=True,
    )


@frappe.whitelist()
def save_weekly_timesheet(employee, start_date, time_logs, timesheet_name=None):
    """Save or update weekly timesheet data"""
    if not employee:
        frappe.throw(_("Employee is required"))

    start_date = getdate(start_date)
    end_date = add_days(start_date, 6)

    # Parse time_logs if it's a string
    if isinstance(time_logs, str):
        import json

        time_logs = json.loads(time_logs)

    timesheet = None

    # If timesheet_name is provided, try to get existing timesheet
    if timesheet_name:
        try:
            timesheet = frappe.get_doc("Timesheet", timesheet_name)
            if timesheet.docstatus == 1:
                frappe.throw(
                    _(
                        "Cannot modify submitted timesheet. Please cancel and amend if needed."
                    )
                )
        except frappe.DoesNotExistError:
            timesheet = None

    # If no timesheet found by name, try to find by employee and date range
    if not timesheet:
        existing_timesheet = frappe.db.get_value(
            "Timesheet",
            {
                "employee": employee,
                "start_date": start_date,
                "end_date": end_date,
                "docstatus": ["<", 2],
            },
        )

        if existing_timesheet:
            timesheet = frappe.get_doc("Timesheet", existing_timesheet)
            if timesheet.docstatus == 1:
                frappe.throw(
                    _(
                        "Cannot modify submitted timesheet. Please cancel and amend if needed."
                    )
                )

    # Create new timesheet if none exists
    if not timesheet:
        timesheet = frappe.new_doc("Timesheet")
        timesheet.employee = employee
        timesheet.start_date = start_date
        timesheet.end_date = end_date
        # Set company from employee
        employee_doc = frappe.get_doc("Employee", employee)
        timesheet.company = employee_doc.company
    else:
        # Clear existing time logs for update
        timesheet.set("time_logs", [])

    # Add time logs
    total_hours = 0
    total_billable_hours = 0

    for log in time_logs:
        if not log.get("hours") or flt(log.get("hours")) <= 0:
            continue

        timesheet.append(
            "time_logs",
            {
                "activity_type": log.get("activity_type"),
                "project": log.get("project"),
                "task": log.get("task"),
                "from_time": log.get("from_time"),
                "to_time": log.get("to_time"),
                "hours": flt(log.get("hours")),
                "is_billable": log.get("is_billable", 0),
                "billing_hours": flt(log.get("billing_hours", 0)),
                "description": log.get("description", ""),
            },
        )

        total_hours += flt(log.get("hours"))
        if log.get("is_billable"):
            total_billable_hours += flt(log.get("billing_hours", log.get("hours")))

    # Save timesheet
    timesheet.flags.ignore_permissions = True
    timesheet.save()

    return {
        "name": timesheet.name,
        "total_hours": total_hours,
        "total_billable_hours": total_billable_hours,
        "docstatus": timesheet.docstatus,
        "status": timesheet.status,
    }


@frappe.whitelist()
def submit_timesheet(timesheet_name):
    """Submit timesheet for approval"""

    timesheet = frappe.get_doc("Timesheet", timesheet_name)

    if timesheet.docstatus != 0:
        frappe.throw(_("Timesheet is already submitted"))

    timesheet.flags.ignore_permissions = True
    timesheet.submit()

    return {"message": _("Timesheet submitted successfully")}


@frappe.whitelist()
def get_activity_cost(employee, activity_type):
    """Get activity cost for employee and activity type"""

    # Get from Activity Cost if exists
    activity_cost = frappe.db.get_value(
        "Activity Cost",
        {"employee": employee, "activity_type": activity_type},
        ["billing_rate", "costing_rate"],
        as_dict=True,
    )

    if activity_cost:
        return activity_cost

    # Get default rates from Activity Type
    activity = frappe.db.get_value(
        "Activity Type", activity_type, ["billing_rate", "costing_rate"], as_dict=True
    )

    return activity or {"billing_rate": 0, "costing_rate": 0}
