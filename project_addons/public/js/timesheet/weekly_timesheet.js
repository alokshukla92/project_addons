class WeeklyTimesheet {
    constructor(parent) {
        this.parent = parent;
        this.current_date = frappe.datetime.get_today();
        this.current_employee = null;
        this.timesheet_data = {};
        this.projects = [];
        this.activity_types = [];
        this.time_entries = {};
        this.current_timesheet = null; // Track current timesheet
        this.has_unsaved_changes = false; // Track unsaved changes
        this.is_submitted = false; // Track if timesheet is submitted
        this.current_docstatus = 0; // Track docstatus (0=Draft, 1=Submitted, 2=Cancelled)

        this.setup();
        this.setup_global_indicators();
        this.setup_page_unload_protection();
    }

    setup() {
        this.setup_filters();
        this.setup_page_actions();
        this.load_data();
    }

    setup_filters() {
        // Create filters in page head
        const filters_html = `
            <div class="row mb-3">
                <div class="col-md-4">
                    <div class="form-group">
                        <label class="control-label">${__('Week Starting')}</label>
                        <div class="input-group">
                            <div class="input-group-prepend">
                                <button class="btn btn-outline-secondary" type="button" id="prev-week">
                                    <i class="fa fa-chevron-left"></i>
                                </button>
                            </div>
                            <input type="date" class="form-control" id="week-start-date" value="${this.format_date_for_input(this.get_week_start(this.current_date))}">
                            <div class="input-group-append">
                                <button class="btn btn-outline-secondary" type="button" id="next-week">
                                    <i class="fa fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                ${frappe.user_roles.includes('HR Manager') || frappe.user_roles.includes('System Manager') ?
                    `<div class="col-md-4">
                        <div class="form-group">
                            <label class="control-label">${__('Employee')}</label>
                            <div class="employee-search-container" style="position: relative;">
                                <input type="text" class="form-control employee-search"
                                       placeholder="${__('Search Employee...')}"
                                       autocomplete="off">
                                <input type="hidden" class="employee-value">
                            </div>
                        </div>
                    </div>` : ''
                }
                <div class="col-md-4">
                    <div class="form-group">
                        <label class="control-label">&nbsp;</label>
                        <div>
                            <button class="btn btn-secondary" id="copy-previous-week-btn">
                                <i class="fa fa-copy"></i> ${__('Copy Previous Week')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $(this.parent.main).prepend(filters_html);

        // Setup event handlers
        $('#week-start-date').on('change', (e) => {
            // Get the selected date and automatically adjust to week start (Sunday)
            const selected_date = new Date(e.target.value);
            const week_start = this.get_week_start(selected_date);
            const formatted_week_start = this.format_date_for_input(week_start);

            // Only update if different to avoid infinite loop
            if (e.target.value !== formatted_week_start) {
                e.target.value = formatted_week_start;
            }

            this.load_data();
        });

        // Week navigation buttons
        $('#prev-week').on('click', () => {
            this.navigate_week(-1);
        });

        $('#next-week').on('click', () => {
            this.navigate_week(1);
        });

        // Copy previous week button
        $('#copy-previous-week-btn').on('click', () => {
            this.copy_previous_week();
        });

        if (frappe.user_roles.includes('HR Manager') || frappe.user_roles.includes('System Manager')) {
            this.setup_employee_dropdown();
        }
    }

    setup_page_actions() {
        // No page actions needed anymore
    }

    setup_global_indicators() {
        // Add CSS styles for read-only timesheet
        const style = $(`
            <style>
                .readonly-timesheet {
                    opacity: 0.8;
                    pointer-events: none;
                }
                .readonly-input {
                    background-color: #f8f9fa !important;
                    border-color: #dee2e6 !important;
                    color: #6c757d !important;
                    cursor: not-allowed !important;
                }
                .disabled-icon {
                    color: #dee2e6 !important;
                    cursor: not-allowed !important;
                    pointer-events: none;
                }
                .disabled-btn {
                    opacity: 0.5;
                    cursor: not-allowed !important;
                    pointer-events: none;
                }
                .readonly-timesheet .time-input:disabled,
                .readonly-timesheet .project-search:disabled,
                .readonly-timesheet .activity-search:disabled {
                    background-color: #f8f9fa !important;
                    border-color: #dee2e6 !important;
                    color: #6c757d !important;
                }
            </style>
        `);

        $('head').append(style);
    }

    setup_page_unload_protection() {
        // Prevent accidental navigation when there are unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.has_unsaved_changes) {
                const message = 'You have unsaved changes. Are you sure you want to leave?';
                e.preventDefault();
                e.returnValue = message;
                return message;
            }
        });

        // Also prevent Frappe navigation
        $(document).on('page_change', (e) => {
            if (this.has_unsaved_changes) {
                if (!confirm('You have unsaved changes. Are you sure you want to leave this page?')) {
                    e.preventDefault();
                    return false;
                }
            }
        });
    }

    get_week_start(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const diff = d.getDate() - day; // Always go back to Sunday
        return new Date(d.setDate(diff));
    }

    format_date_for_input(date) {
        // Format date for HTML date input (YYYY-MM-DD)
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }

    navigate_week(direction) {
        // direction: -1 for previous week, 1 for next week
        const current_date = new Date($('#week-start-date').val());
        current_date.setDate(current_date.getDate() + (direction * 7));
        const week_start = this.get_week_start(current_date);
        $('#week-start-date').val(this.format_date_for_input(week_start));
        this.load_data();
    }

    format_datetime_for_frappe(date) {
        // Format date for Frappe backend (YYYY-MM-DD HH:MM:SS)
        const d = new Date(date);
        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0') + ' ' +
               String(d.getHours()).padStart(2, '0') + ':' +
               String(d.getMinutes()).padStart(2, '0') + ':' +
               String(d.getSeconds()).padStart(2, '0');
    }

    add_hours_to_date(date, hours) {
        const d = new Date(date);
        d.setHours(d.getHours() + hours);
        return d;
    }

    async setup_employee_dropdown() {
        const container = $('.employee-search-container');

        // Create dropdown separately and append to body to avoid table constraints
        const dropdown = $(`
            <div class="employee-dropdown" style="display: none; position: fixed; background: white; border: none; max-height: 200px; overflow-y: auto; z-index: 999999; border-radius: 6px; box-shadow: 0 8px 16px rgba(0,0,0,0.15); min-width: 220px;">
            </div>
        `);

        $('body').append(dropdown);

        const input = container.find('.employee-search');
        const hiddenInput = container.find('.employee-value');

        let employees = [];

        try {
            // Fetch all employees
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Employee',
                    fields: ['name', 'employee_name'],
                    filters: {
                        status: 'Active'
                    },
                    order_by: 'employee_name',
                    limit_page_length: 0
                }
            });

            if (response.message) {
                employees = response.message;
            }

        } catch (error) {
            console.error('Error fetching employees:', error);
            frappe.show_alert({message: __('Error loading employees'), indicator: 'red'});
        }

        // Search functionality
        input.on('input', (e) => {
            // Hide any other open dropdowns first
            $('body').find('.project-dropdown, .activity-dropdown, .employee-dropdown').not(dropdown).hide();

            const query = e.target.value.toLowerCase();
            const filtered = employees.filter(employee =>
                employee.employee_name.toLowerCase().includes(query) ||
                employee.name.toLowerCase().includes(query)
            );

            this.position_dropdown(input, dropdown);
            this.render_employee_dropdown(dropdown, filtered, input, hiddenInput);
            dropdown.show();
        });

        // Focus event
        input.on('focus', () => {
            // Hide any other open dropdowns first
            $('body').find('.project-dropdown, .activity-dropdown, .employee-dropdown').hide();

            this.position_dropdown(input, dropdown);
            this.render_employee_dropdown(dropdown, employees, input, hiddenInput);
            dropdown.show();
        });

        // Click outside to close
        $(document).on('click', (e) => {
            if (!container.is(e.target) && container.has(e.target).length === 0 &&
                !dropdown.is(e.target) && dropdown.has(e.target).length === 0) {
                dropdown.hide();
            }
        });

        // Reposition on scroll
        $(window).on('scroll resize', () => {
            if (dropdown.is(':visible')) {
                this.position_dropdown(input, dropdown);
            }
        });
    }

    render_employee_dropdown(dropdown, employees, input, hiddenInput) {
        dropdown.empty();

        if (employees.length === 0) {
            dropdown.append('<div style="padding: 8px; color: #999;">No employees found</div>');
            return;
        }

        employees.slice(0, 10).forEach(employee => {
            const item = $(`
                <div class="dropdown-item" style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;"
                     data-value="${employee.name}">
                    <div style="font-weight: 500; margin-bottom: 4px;">${employee.employee_name}</div>
                    <small style="color: #666;">${employee.name}</small>
                </div>
            `);

            item.on('click', () => {
                input.val(employee.employee_name);
                hiddenInput.val(employee.name);
                dropdown.hide();
                this.load_data(); // Reload data when employee changes
            });

            item.on('mouseenter', function() {
                $(this).css('background-color', '#f8f9fa');
            });

            item.on('mouseleave', function() {
                $(this).css('background-color', 'white');
            });

            dropdown.append(item);
        });

        if (employees.length > 10) {
            dropdown.append(`<div style="padding: 8px; color: #666; font-style: italic;">Showing first 10 results</div>`);
        }
    }

    async load_data() {
        const week_start = $('#week-start-date').val();
        const employee = $('.employee-value').val() || null;

        frappe.call({
            method: 'project_addons.project_addons.api.timesheet.get_weekly_timesheet_data',
            args: {
                start_date: week_start,
                employee: employee
            },
            callback: (r) => {
                if (r.message) {
                    this.timesheet_data = r.message;
                    this.current_employee = r.message.employee;
                    this.projects = r.message.projects;
                    this.activity_types = r.message.activity_types;

                    // Extract current timesheet info - use latest modified timesheet
                    this.current_timesheet = null;
                    if (r.message.timesheets && r.message.timesheets.length > 0) {
                        // Get the first timesheet (latest modified due to ORDER BY ts.modified DESC)
                        this.current_timesheet = r.message.timesheets[0].name;
                    }

                    this.render_timesheet_grid();

                    // Update status based on existing timesheet data
                    if (r.message.timesheets && r.message.timesheets.length > 0) {
                        // Use the first timesheet (latest modified)
                        const latestTimesheet = r.message.timesheets[0];
                        this.current_docstatus = latestTimesheet.docstatus || 0;
                        this.is_submitted = this.current_docstatus === 1;
                        this.update_status_indicator(latestTimesheet.status, latestTimesheet.docstatus);
                        this.update_timesheet_id_display(latestTimesheet.name);
                        this.update_ui_for_submission_status();
                    } else {
                        // No existing timesheet, reset to draft state
                        this.current_docstatus = 0;
                        this.is_submitted = false;
                        this.update_timesheet_id_display(null);
                        this.update_ui_for_submission_status();
                    }
                }
            }
        });
    }

    render_timesheet_grid() {
        const container = $(this.parent.main);

        // Remove existing timesheet content (but keep filters)
        container.find('.timesheet-content').remove();

        // Create content wrapper
        const content_wrapper = $('<div class="timesheet-content"></div>');
        container.append(content_wrapper);

        // Summary section
        this.render_summary(content_wrapper);

        // Timesheet grid
        this.render_grid(content_wrapper);

        // Add new entry button
        this.render_add_entry_section(content_wrapper);
    }

    render_summary(container) {
        const summary_html = `
            <div class="row mb-4 timesheet-summary">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5>${__('Week Summary')} - ${this.current_employee.employee_name}</h5>
                            <small class="text-muted">
                                ${frappe.format(this.timesheet_data.date_range.start_date, 'Date')}
                                to
                                ${frappe.format(this.timesheet_data.date_range.end_date, 'Date')}
                            </small>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h4 class="text-primary" id="billable-hours">0:00</h4>
                                        <small class="text-muted">${__('Billable')}</small>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h4 class="text-info" id="non-billable-hours">0:00</h4>
                                        <small class="text-muted">${__('Non Billable')}</small>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <h4 class="text-success" id="total-hours">0:00</h4>
                                        <small class="text-muted">${__('Total Hours')}</small>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="text-center">
                                        <div id="unsaved-changes-indicator" style="display: none; margin-bottom: 8px;">
                                            <span class="badge badge-warning">
                                                <i class="fa fa-exclamation-circle"></i> ${__('Unsaved Changes')}
                                            </span>
                                        </div>
                                        <div id="submission-actions" style="display: none; margin-bottom: 8px;">
                                            <button class="btn btn-xs btn-warning" id="amend-timesheet-btn" style="display: none;">
                                                <i class="fa fa-edit"></i> ${__('Amend')}
                                            </button>
                                            <button class="btn btn-xs btn-danger" id="cancel-timesheet-btn" style="display: none;">
                                                <i class="fa fa-ban"></i> ${__('Cancel')}
                                            </button>
                                        </div>
                                        <span class="indicator gray" id="status-indicator">
                                            ${__('Draft')}
                                        </span>
                                        <div id="timesheet-id-display" style="margin-top: 5px; display: none;">
                                            <small class="text-muted">ID: <span id="timesheet-id"></span></small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.append(summary_html);

        // Setup event handlers for amend/cancel buttons
        $('#amend-timesheet-btn').on('click', () => {
            this.amend_timesheet();
        });

        $('#cancel-timesheet-btn').on('click', () => {
            this.cancel_timesheet();
        });
    }

    render_grid(container) {
        const grid_html = `
            <div class="row">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${__('Time Entries')}</h6>
                            <button class="btn btn-xs btn-default" id="add-task-btn">
                                <i class="fa fa-plus"></i> ${__('Add Entry')}
                            </button>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive timesheet-grid-container">
                                <table class="table table-bordered timesheet-grid">
                                    <thead>
                                        <tr>
                                            <th class="text-center project-header" style="width: 200px; min-width: 200px; max-width: 200px">${__('Project')}</th>
                                            <th class="text-center activity-header" style="width: 200px; min-width: 200px; max-width: 200px">${__('Activity Type')}</th>
                                            <th class="text-center day-header" style="width: 85px; min-width: 85px; max-width: 85px">${__('Sun')}<br><small>${this.get_day_date(0)}</small></th>
                                            <th class="text-center day-header" style="width: 85px; min-width: 85px; max-width: 85px">${__('Mon')}<br><small>${this.get_day_date(1)}</small></th>
                                            <th class="text-center day-header" style="width: 85px; min-width: 85px; max-width: 85px">${__('Tue')}<br><small>${this.get_day_date(2)}</small></th>
                                            <th class="text-center day-header" style="width: 85px; min-width: 85px; max-width: 85px">${__('Wed')}<br><small>${this.get_day_date(3)}</small></th>
                                            <th class="text-center day-header" style="width: 85px; min-width: 85px; max-width: 85px">${__('Thu')}<br><small>${this.get_day_date(4)}</small></th>
                                            <th class="text-center day-header" style="width: 85px; min-width: 85px; max-width: 85px">${__('Fri')}<br><small>${this.get_day_date(5)}</small></th>
                                            <th class="text-center day-header" style="width: 85px; min-width: 85px; max-width: 85px">${__('Sat')}<br><small>${this.get_day_date(6)}</small></th>
                                            <th class="text-center total-header" style="width: 90px; min-width: 90px; max-width: 90px">${__('Total')}<br><small>${__('HRS/WEEK')}</small></th>
                                            <th class="text-center actions-header" style="width: 35px !important; min-width: 35px !important; max-width: 35px !important; padding: 4px !important; overflow: hidden !important;"></th>
                                        </tr>
                                    </thead>
                                    <tbody id="timesheet-rows">
                                        <!-- Dynamic rows will be added here -->
                                    </tbody>
                                    <tfoot>
                                        <tr class="font-weight-bold">
                                            <td colspan="2">${__('Total hours/ day')}</td>
                                            <td class="text-center" id="day-total-0">0:00</td>
                                            <td class="text-center" id="day-total-1">0:00</td>
                                            <td class="text-center" id="day-total-2">0:00</td>
                                            <td class="text-center" id="day-total-3">0:00</td>
                                            <td class="text-center" id="day-total-4">0:00</td>
                                            <td class="text-center" id="day-total-5">0:00</td>
                                            <td class="text-center" id="day-total-6">0:00</td>
                                            <td class="text-center" id="week-total">0:00</td>
                                            <td></td>
                                        </tr>
                                        <tr>
                                            <td colspan="11" class="p-2">
                                                <div class="row">
                                                    <div class="col-6">
                                                        <small class="text-muted d-flex align-items-center">
                                                            <i class="fa fa-circle text-success mr-1"></i> ${__('Submitted')}
                                                            <i class="fa fa-circle text-warning ml-3 mr-1"></i> ${__('Draft')}
                                                            <i class="fa fa-circle text-muted ml-3 mr-1"></i> ${__('Empty')}
                                                        </small>
                                                    </div>
                                                    <div class="col-6 text-right">
                                                        <div class="d-inline-flex">
                                                            <button class="btn btn-xs btn-default" id="save-btn">
                                                                <i class="fa fa-save"></i> ${__('Save')}
                                                            </button>
                                                            <button class="btn btn-xs btn-primary ml-2" id="submit-weekly-btn">
                                                                <i class="fa fa-check-circle"></i> ${__('Submit')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.append(grid_html);
        this.setup_grid_events();
        this.populate_grid();

        // Force dimensions for all rows after grid is populated
        this.force_all_actions_column_dimensions();

        // Set up continuous monitoring to prevent external CSS from overriding
        this.setup_dimension_monitoring();
    }

    force_all_actions_column_dimensions() {
        // Force dimensions for all existing rows
        $('#timesheet-rows tr').each((index, row) => {
            const row_id = $(row).data('row-id');
            if (row_id) {
                this.force_actions_column_dimensions(row_id);
            }
        });

        // Also force header dimensions
        $('.actions-header').css({
            'width': '35px',
            'min-width': '35px',
            'max-width': '35px',
            'padding': '4px',
            'overflow': 'hidden',
            'box-sizing': 'border-box'
        });
    }

    force_actions_column_dimensions(row_id) {
        const row = $(`tr[data-row-id="${row_id}"]`);
        const actionsCell = row.find('.actions-cell');
        const deleteButton = actionsCell.find('.remove-row');

        // Force actions cell dimensions
        actionsCell.css({
            'width': '35px',
            'min-width': '35px',
            'max-width': '35px',
            'padding': '4px',
            'overflow': 'hidden',
            'box-sizing': 'border-box'
        });

        // Force delete button dimensions
        deleteButton.css({
            'width': '28px',
            'height': '28px',
            'min-width': '28px',
            'max-width': '28px',
            'padding': '4px',
            'margin': '0 auto',
            'display': 'block',
            'overflow': 'hidden',
            'box-sizing': 'border-box',
            'font-size': '11px',
            'line-height': '1',
            'border-radius': '3px'
        });
    }

    get_day_date(day_offset) {
        const start_date = new Date(this.timesheet_data.date_range.start_date);
        const day_date = new Date(start_date);
        day_date.setDate(start_date.getDate() + day_offset);
        return day_date.getDate();
    }

    setup_grid_events() {
        // Add task button
        $('#add-task-btn').on('click', () => {
            this.add_new_task_row();
        });

        // Save button
        $('#save-btn').on('click', () => {
            this.save_timesheet();
        });

        // Submit button
        $('#submit-weekly-btn').on('click', () => {
            this.submit_timesheet();
        });
    }

    populate_grid() {
        const tbody = $('#timesheet-rows');
        tbody.empty();
        
        // Clean up any existing dropdowns from previous render
        $('body').find('.project-dropdown, .activity-dropdown').remove();

        // Group timesheet entries by task/project
        const grouped_entries = this.group_timesheet_entries();

        // Add rows for each unique task/project combination
        Object.keys(grouped_entries).forEach(key => {
            this.add_task_row(grouped_entries[key]);
        });

        // Add empty row for new entries
        this.add_new_task_row();

        this.calculate_totals();

        // Force dimensions for all rows after grid is populated
        this.force_all_actions_column_dimensions();

        // Set up continuous monitoring to prevent external CSS from overriding
        this.setup_dimension_monitoring();
    }

    group_timesheet_entries() {
        const grouped = {};

        this.timesheet_data.timesheets.forEach(entry => {
            const key = `${entry.project || ''}-${entry.task || ''}-${entry.activity_type || ''}`;

            if (!grouped[key]) {
                grouped[key] = {
                    project: entry.project,
                    project_name: entry.project_name,
                    task: entry.task,
                    task_name: entry.task_name,
                    activity_type: entry.activity_type,
                    activity_name: entry.activity_name,
                    is_billable: entry.is_billable,
                    description: entry.description || '',
                    daily_hours: [0, 0, 0, 0, 0, 0, 0],
                    notes: ['', '', '', '', '', '', '']
                };
            }

            // Calculate which day of week this entry belongs to
            const entry_date = new Date(entry.from_time);
            const start_date = new Date(this.timesheet_data.date_range.start_date);
            const day_diff = Math.floor((entry_date - start_date) / (1000 * 60 * 60 * 24));

            if (day_diff >= 0 && day_diff < 7) {
                grouped[key].daily_hours[day_diff] += entry.hours || 0;
                if (entry.description) {
                    grouped[key].notes[day_diff] = entry.description;
                }
            }
        });

        return grouped;
    }

    add_task_row(task_data = null) {
        const row_id = 'row_' + Date.now() + Math.random().toString(36).substr(2, 9);

        const row_html = `
            <tr data-row-id="${row_id}">
                <td class="project-cell">
                    <div class="project-link-field" data-field="project"></div>
                </td>
                <td class="activity-cell">
                    <div class="activity-link-field" data-field="activity"></div>
                </td>
                ${this.generate_day_cells(row_id, task_data)}
                <td class="text-center task-total">
                    <strong>0:00</strong>
                </td>
                <td class="text-center actions-cell" style="width: 35px !important; min-width: 35px !important; max-width: 35px !important; padding: 4px !important; overflow: hidden !important;">
                    <button class="btn btn-xs btn-danger remove-row" title="${__('Remove')}" style="width: 28px !important; height: 28px !important; min-width: 28px !important; max-width: 28px !important; padding: 4px !important; margin: 0 auto !important; display: block !important; overflow: hidden !important; box-sizing: border-box !important;">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;

        $('#timesheet-rows').append(row_html);
        this.setup_row_events(row_id);
        this.setup_link_fields(row_id, task_data);

        if (task_data) {
            this.populate_row_data(row_id, task_data);
        }

        // Force correct dimensions for this specific row
        this.force_actions_column_dimensions(row_id);
    }

    setup_link_fields(row_id, task_data = null) {
        const row = $(`tr[data-row-id="${row_id}"]`);

        // Setup Project Dropdown
        this.setup_project_dropdown(row, row_id, task_data);

        // Setup Activity Type Dropdown
        this.setup_activity_dropdown(row, row_id, task_data);
    }

    async setup_project_dropdown(row, row_id, task_data = null) {
        const project_cell = row.find('.project-link-field');
        project_cell.empty();

        // Create input container (without dropdown - dropdown will be appended to body)
        const container = $(`
            <div class="project-search-container" style="position: relative;">
                <input type="text" class="form-control form-control-sm project-search"
                       placeholder="${__('Search Project...')}"
                       data-row-id="${row_id}"
                       autocomplete="off">
                <input type="hidden" class="project-value" data-row-id="${row_id}">
            </div>
        `);

        // Create dropdown separately and append to body to avoid table constraints
        const dropdown = $(`
            <div class="project-dropdown project-dropdown-${row_id}" style="display: none; position: fixed; background: white; border: none; max-height: 200px; overflow-y: auto; z-index: 999999; border-radius: 6px; box-shadow: 0 8px 16px rgba(0,0,0,0.15); min-width: 220px;">
            </div>
        `);
        
        $('body').append(dropdown);

        project_cell.append(container);

        const input = container.find('.project-search');
        const hiddenInput = container.find('.project-value');

        let projects = [];

        try {
            // Fetch all projects
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Project',
                    fields: ['name', 'project_name'],
                    filters: {
                        status: 'Open'
                    },
                    limit_page_length: 0
                }
            });

            if (response.message) {
                projects = response.message;
            }

        } catch (error) {
            console.error('Error fetching projects:', error);
            frappe.show_alert({message: __('Error loading projects'), indicator: 'red'});
        }

        // Search functionality
        input.on('input', (e) => {
            // Hide any other open dropdowns first
            $('body').find('.project-dropdown, .activity-dropdown').not(dropdown).hide();
            
            const query = e.target.value.toLowerCase();
            const filtered = projects.filter(project =>
                project.project_name.toLowerCase().includes(query) ||
                project.name.toLowerCase().includes(query)
            );

            this.position_dropdown(input, dropdown);
            this.render_project_dropdown(dropdown, filtered, input, hiddenInput, row_id);
            dropdown.show();
        });

        // Focus event
        input.on('focus', () => {
            // Hide any other open dropdowns first
            $('body').find('.project-dropdown, .activity-dropdown').hide();
            
            this.position_dropdown(input, dropdown);
            this.render_project_dropdown(dropdown, projects, input, hiddenInput, row_id);
            dropdown.show();
        });

        // Click outside to close
        $(document).on('click', (e) => {
            if (!container.is(e.target) && container.has(e.target).length === 0 && 
                !dropdown.is(e.target) && dropdown.has(e.target).length === 0) {
                dropdown.hide();
            }
        });

        // Reposition on scroll
        $(window).on('scroll resize', () => {
            if (dropdown.is(':visible')) {
                this.position_dropdown(input, dropdown);
            }
        });

        // Set initial value if provided
        if (task_data && task_data.project) {
            const project = projects.find(p => p.name === task_data.project);
            if (project) {
                input.val(project.project_name);
                hiddenInput.val(project.name);
            }
        }
    }

    render_project_dropdown(dropdown, projects, input, hiddenInput, row_id) {
        dropdown.empty();

        if (projects.length === 0) {
            dropdown.append('<div style="padding: 8px; color: #999;">No projects found</div>');
            return;
        }

        projects.slice(0, 10).forEach(project => {
            const item = $(`
                <div class="dropdown-item" style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;"
                     data-value="${project.name}">
                    <div style="font-weight: 500; margin-bottom: 4px;">${project.project_name}</div>
                    <small style="color: #666;">${project.name}</small>
                </div>
            `);

            item.on('click', () => {
                input.val(project.project_name);
                hiddenInput.val(project.name);
                dropdown.hide();
                this.handle_project_selection(row_id, project.name);
            });

            item.on('mouseenter', function() {
                $(this).css('background-color', '#f8f9fa');
            });

            item.on('mouseleave', function() {
                $(this).css('background-color', 'white');
            });

            dropdown.append(item);
        });

        if (projects.length > 10) {
            dropdown.append(`<div style="padding: 8px; color: #666; font-style: italic;">Showing first 10 results</div>`);
        }
    }

            position_dropdown(input, dropdown) {
        const inputOffset = input.offset();
        const inputHeight = input.outerHeight();
        const inputWidth = input.outerWidth();
        const windowHeight = $(window).height();
        const dropdownHeight = 200; // max-height of dropdown
        
        // Calculate available space below and above
        const spaceBelow = windowHeight - (inputOffset.top + inputHeight);
        const spaceAbove = inputOffset.top;
        
        let top, dropDirection;
        
        // If there's enough space below, position dropdown below
        if (spaceBelow >= dropdownHeight + 10) {
            top = inputOffset.top + inputHeight;
            dropDirection = 'down';
        }
        // If there's more space above than below, position dropdown above
        else if (spaceAbove > spaceBelow && spaceAbove >= 100) {
            top = inputOffset.top - Math.min(dropdownHeight, spaceAbove - 10);
            dropDirection = 'up';
        }
        // Otherwise, position below but limit height
        else {
            top = inputOffset.top + inputHeight;
            dropDirection = 'down';
        }

        // Position dropdown using fixed positioning
        dropdown.css({
            'top': top + 'px',
            'left': inputOffset.left + 'px',
            'width': Math.max(inputWidth, 220) + 'px',
            'position': 'fixed',
            'max-height': dropDirection === 'up' ? Math.min(dropdownHeight, spaceAbove - 10) + 'px' : 
                         dropDirection === 'down' && spaceBelow < dropdownHeight ? (spaceBelow - 10) + 'px' : 
                         dropdownHeight + 'px'
        });
    }

    async setup_activity_dropdown(row, row_id, task_data = null) {
        const activity_cell = row.find('.activity-link-field');
        activity_cell.empty();

        // Create input container (without dropdown - dropdown will be appended to body)
        const container = $(`
            <div class="activity-search-container" style="position: relative;">
                <input type="text" class="form-control form-control-sm activity-search"
                       placeholder="${__('Search Activity Type...')}"
                       data-row-id="${row_id}"
                       autocomplete="off">
                <input type="hidden" class="activity-value" data-row-id="${row_id}">
            </div>
        `);

        // Create dropdown separately and append to body to avoid table constraints
        const dropdown = $(`
            <div class="activity-dropdown activity-dropdown-${row_id}" style="display: none; position: fixed; background: white; border: none; max-height: 200px; overflow-y: auto; z-index: 999999; border-radius: 6px; box-shadow: 0 8px 16px rgba(0,0,0,0.15); min-width: 220px;">
            </div>
        `);
        
        $('body').append(dropdown);

        activity_cell.append(container);

        const input = container.find('.activity-search');
        const hiddenInput = container.find('.activity-value');

        let activities = [];

        try {
            // Fetch all activity types
            const response = await frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Activity Type',
                    fields: ['name'],
                    filters: {
                        disabled: 0
                    },
                    limit_page_length: 0
                }
            });

            if (response.message) {
                activities = response.message;
            }

        } catch (error) {
            console.error('Error fetching activity types:', error);
            frappe.show_alert({message: __('Error loading activity types'), indicator: 'red'});
        }

        // Search functionality
        input.on('input', (e) => {
            // Hide any other open dropdowns first
            $('body').find('.project-dropdown, .activity-dropdown').not(dropdown).hide();
            
            const query = e.target.value.toLowerCase();
            const filtered = activities.filter(activity =>
                activity.name.toLowerCase().includes(query)
            );

            this.position_dropdown(input, dropdown);
            this.render_activity_dropdown(dropdown, filtered, input, hiddenInput, row_id);
            dropdown.show();
        });

        // Focus event
        input.on('focus', () => {
            // Hide any other open dropdowns first
            $('body').find('.project-dropdown, .activity-dropdown').hide();
            
            this.position_dropdown(input, dropdown);
            this.render_activity_dropdown(dropdown, activities, input, hiddenInput, row_id);
            dropdown.show();
        });

        // Click outside to close
        $(document).on('click', (e) => {
            if (!container.is(e.target) && container.has(e.target).length === 0 && 
                !dropdown.is(e.target) && dropdown.has(e.target).length === 0) {
                dropdown.hide();
            }
        });

        // Reposition on scroll
        $(window).on('scroll resize', () => {
            if (dropdown.is(':visible')) {
                this.position_dropdown(input, dropdown);
            }
        });

        // Set initial value if provided
        if (task_data && task_data.activity_type) {
            const activity = activities.find(a => a.name === task_data.activity_type);
            if (activity) {
                input.val(activity.name);
                hiddenInput.val(activity.name);
            }
        }
    }

    render_activity_dropdown(dropdown, activities, input, hiddenInput, row_id) {
        dropdown.empty();

        if (activities.length === 0) {
            dropdown.append('<div style="padding: 8px; color: #999;">No activity types found</div>');
            return;
        }

        activities.slice(0, 10).forEach(activity => {
            const item = $(`
                <div class="dropdown-item" style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f0f0f0;"
                     data-value="${activity.name}">
                    <div style="font-weight: 500;">${activity.name}</div>
                </div>
            `);

            item.on('click', () => {
                input.val(activity.name);
                hiddenInput.val(activity.name);
                dropdown.hide();
                this.handle_activity_selection(row_id, activity.name);
            });

            item.on('mouseenter', function() {
                $(this).css('background-color', '#f8f9fa');
            });

            item.on('mouseleave', function() {
                $(this).css('background-color', 'white');
            });

            dropdown.append(item);
        });

        if (activities.length > 10) {
            dropdown.append(`<div style="padding: 8px; color: #666; font-style: italic;">Showing first 10 results</div>`);
        }
    }

    generate_day_cells(row_id, task_data = null) {
        let cells = '';
        for (let day = 0; day < 7; day++) {
            const hours = task_data ? this.format_hours(task_data.daily_hours[day]) : '';
            const description = task_data && task_data.notes ? task_data.notes[day] : '';

            cells += `
                <td class="text-center day-cell" data-day="${day}">
                    <div class="time-entry-container">
                        <input type="text" class="form-control form-control-sm text-center time-input"
                               value="${hours}" data-day="${day}" data-row-id="${row_id}" placeholder="0:00">
                        <i class="fa fa-info-circle time-description-icon"
                           data-day="${day}"
                           data-row-id="${row_id}"
                           data-description="${description}"
                           title="${description || __('Click to add description')}"
                           style="cursor: pointer; margin-left: 2px; color: ${description ? '#007bff' : '#999'};"></i>
                        <input type="hidden" class="time-description"
                               data-day="${day}"
                               data-row-id="${row_id}"
                               value="${description}">
                    </div>
                </td>
            `;
        }
        return cells;
    }

    setup_row_events(row_id) {
        const row = $(`tr[data-row-id="${row_id}"]`);

        // Time input changes
        row.find('.time-input').on('change', (e) => {
            this.handle_time_change(row_id, $(e.target));
        });

        // Description icon clicks
        row.find('.time-description-icon').on('click', (e) => {
            this.handle_description_edit($(e.target));
        });

        // Add instant hover tooltips for description icons
        row.find('.time-description-icon').each((index, icon) => {
            const $icon = $(icon);
            this.setup_instant_tooltip($icon);
        });

        // Remove row
        row.find('.remove-row').on('click', () => {
            // Clean up link field references
            if (this.link_fields && this.link_fields[row_id]) {
                delete this.link_fields[row_id];
            }

            // Remove associated dropdowns from body
            $(`.project-dropdown-${row_id}, .activity-dropdown-${row_id}`).remove();

            row.remove();
            this.calculate_totals();

            // Check if we still have meaningful changes after removing the row
            if (this.has_meaningful_changes()) {
                this.mark_as_changed();
            } else {
                this.mark_as_saved(); // Hide indicator if no meaningful changes remain
            }
        });
    }

    handle_project_selection(row_id, project_id) {
        // Store project selection for this row
        this.time_entries[row_id] = this.time_entries[row_id] || {};
        this.time_entries[row_id].project = project_id;
        this.mark_as_changed(); // Mark as changed when project is selected
    }

    handle_activity_selection(row_id, activity_id) {
        // Store activity selection for this row
        this.time_entries[row_id] = this.time_entries[row_id] || {};
        this.time_entries[row_id].activity_type = activity_id;
        this.mark_as_changed(); // Mark as changed when activity is selected
    }

    handle_description_edit(icon) {
        const day = icon.data('day');
        const row_id = icon.data('row-id');
        const current_description = icon.data('description') || '';

        // Create a simple prompt dialog for description
        frappe.prompt({
            label: __('Description'),
            fieldname: 'description',
            fieldtype: 'Small Text',
            default: current_description,
            description: __('Enter description for this time entry')
        }, (values) => {
            const new_description = values.description || '';

            // Update the hidden input
            const hidden_input = $(`tr[data-row-id="${row_id}"] .time-description[data-day="${day}"]`);
            hidden_input.val(new_description);

            // Update the icon
            icon.data('description', new_description);
            icon.attr('title', new_description || __('Click to add description'));
            icon.css('color', new_description ? '#007bff' : '#999');

            this.mark_as_changed(); // Mark as changed when description is updated

        }, __('Edit Description'));
    }

    handle_time_change(row_id, input) {
        const hours = this.parse_time_input(input.val());
        input.val(this.format_hours(hours));
        this.calculate_row_total(row_id);
        this.calculate_totals();

        // Check if we have meaningful changes after time modification
        if (this.has_meaningful_changes()) {
            this.mark_as_changed();
        } else {
            this.mark_as_saved(); // Hide indicator if no meaningful changes remain
        }
    }

    parse_time_input(value) {
        if (!value) return 0;

        // Handle formats like 1:30, 1.5, 90m, etc.
        if (value.includes(':')) {
            const [hours, minutes] = value.split(':');
            return parseFloat(hours) + parseFloat(minutes || 0) / 60;
        }

        return parseFloat(value) || 0;
    }

    format_hours(hours) {
        if (!hours) return '0:00';

        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    }

    calculate_row_total(row_id) {
        const row = $(`tr[data-row-id="${row_id}"]`);
        let total = 0;

        row.find('.time-input').each((i, input) => {
            total += this.parse_time_input($(input).val());
        });

        row.find('.task-total strong').text(this.format_hours(total));
    }

    calculate_totals() {
        const day_totals = [0, 0, 0, 0, 0, 0, 0];
        let week_total = 0;
        let billable_total = 0;
        let non_billable_total = 0;

        $('#timesheet-rows tr').each((i, row) => {
            const $row = $(row);
            let row_total = 0;

            $row.find('.time-input').each((day, input) => {
                const hours = this.parse_time_input($(input).val());
                day_totals[day] += hours;
                row_total += hours;

                // Determine if billable
                const is_billable = $row.find('.indicator.green').length > 0;
                if (is_billable) {
                    billable_total += hours;
                } else {
                    non_billable_total += hours;
                }
            });

            week_total += row_total;
            $row.find('.task-total strong').text(this.format_hours(row_total));
        });

        // Update day totals
        day_totals.forEach((total, day) => {
            $(`#day-total-${day}`).text(this.format_hours(total));
        });

        // Update summary
        $('#week-total').text(this.format_hours(week_total));
        $('#total-hours').text(this.format_hours(week_total));
        $('#billable-hours').text(this.format_hours(billable_total));
        $('#non-billable-hours').text(this.format_hours(non_billable_total));
    }

    add_new_task_row() {
        this.add_task_row();
        // Don't mark as changed just for adding an empty row
        // The change will be marked when user actually enters data
    }

    populate_row_data(row_id, task_data) {
        const row = $(`tr[data-row-id="${row_id}"]`);

        // Populate time inputs
        task_data.daily_hours.forEach((hours, day) => {
            if (hours > 0) {
                row.find(`.time-input[data-day="${day}"]`).val(this.format_hours(hours));
            }
        });

        // Populate descriptions for each day (already handled in generate_day_cells)

        this.calculate_row_total(row_id);
    }

    save_timesheet() {
        const time_logs = this.collect_time_entries();

        if (time_logs.length === 0) {
            frappe.msgprint(__('No time entries to save'));
            return;
        }

        frappe.call({
            method: 'project_addons.project_addons.api.timesheet.save_weekly_timesheet',
            args: {
                employee: this.current_employee.name,
                start_date: this.timesheet_data.date_range.start_date,
                time_logs: time_logs,
                timesheet_name: this.current_timesheet // Pass current timesheet name
            },
            callback: (r) => {
                if (r.message) {
                    // Update current timesheet reference
                    this.current_timesheet = r.message.name;

                    frappe.show_alert({
                        message: __('Timesheet saved successfully'),
                        indicator: 'green'
                    });

                    // Remove changed indicator
                    this.mark_as_saved();

                    // Update status indicator
                    this.update_status_indicator(r.message.status, r.message.docstatus);

                    // Optionally refresh data to show updated totals
                    this.load_data();
                }
            }
        });
    }

    submit_timesheet() {
        if (!this.current_timesheet) {
            // Save first if no timesheet exists
            frappe.msgprint(__('Please save the timesheet first'));
            return;
        }

        frappe.confirm(__('Are you sure you want to submit this timesheet?'), () => {
            frappe.call({
                method: 'project_addons.project_addons.api.timesheet.submit_timesheet',
                args: {
                    timesheet_name: this.current_timesheet
                },
                callback: (r) => {
                    if (r.message) {
                        frappe.show_alert({
                            message: r.message.message || __('Timesheet submitted successfully'),
                            indicator: 'green'
                        });

                        // Clear unsaved changes flag since timesheet is submitted
                        this.mark_as_saved();

                        // Update status and refresh data
                        this.update_status_indicator('Submitted', 1);
                        this.load_data();
                    }
                }
            });
        });
    }

    collect_time_entries() {
        const entries = [];

        $('#timesheet-rows tr').each((i, row) => {
            const $row = $(row);
            const row_id = $row.data('row-id');

            // Get values from search fields
            let project = $row.find('.project-value').val();
            let activity_type = $row.find('.activity-value').val();

            if (!project && !activity_type) return;

            // Collect time for each day
            $row.find('.time-input').each((day, input) => {
                const hours = this.parse_time_input($(input).val());

                if (hours > 0) {
                    // Get description for this specific day
                    const description = $row.find(`.time-description[data-day="${day}"]`).val() || '';

                    const entry_date = new Date(this.timesheet_data.date_range.start_date);
                    entry_date.setDate(entry_date.getDate() + day);
                    entry_date.setHours(9, 0, 0, 0); // Set to 9 AM as default start time

                    entries.push({
                        project: project || null,
                        task: null, // We can add task support later
                        activity_type: activity_type || null,
                        hours: hours,
                        is_billable: 0, // Default to non-billable since we removed the checkbox
                        billing_hours: 0, // Default to 0 since we removed the checkbox
                        from_time: this.format_datetime_for_frappe(entry_date),
                        to_time: this.format_datetime_for_frappe(this.add_hours_to_date(entry_date, hours)),
                        description: description
                    });
                }
            });
        });

        return entries;
    }

    async copy_previous_week() {
        // Calculate previous week start date
        const current_week_start = new Date($('#week-start-date').val());
        const previous_week_start = new Date(current_week_start);
        previous_week_start.setDate(previous_week_start.getDate() - 7);

        const employee = $('.employee-value').val() || null;

        // Fetch previous week's timesheet data
        try {
            const response = await frappe.call({
                method: 'project_addons.project_addons.api.timesheet.get_weekly_timesheet_data',
                args: {
                    start_date: this.format_date_for_input(previous_week_start),
                    employee: employee
                }
            });

            if (response.message && response.message.timesheets && response.message.timesheets.length > 0) {
                // Show preview dialog
                this.show_copy_preview_dialog(response.message, previous_week_start);
            } else {
                frappe.msgprint({
                    title: __('No Data Found'),
                    message: __('No timesheet data found for the previous week ({0} to {1})', [
                        frappe.format(previous_week_start, 'Date'),
                        frappe.format(new Date(previous_week_start.getTime() + 6 * 24 * 60 * 60 * 1000), 'Date')
                    ]),
                    indicator: 'orange'
                });
            }
        } catch (error) {
            console.error('Error fetching previous week data:', error);
            frappe.show_alert({
                message: __('Error loading previous week data'),
                indicator: 'red'
            });
        }
    }

    show_copy_preview_dialog(previous_week_data, previous_week_start) {
        // Group previous week entries just like we do for current week
        const grouped_entries = this.group_timesheet_entries_for_preview(previous_week_data.timesheets, previous_week_data.date_range);

        // Calculate week end date
        const previous_week_end = new Date(previous_week_start.getTime() + 6 * 24 * 60 * 60 * 1000);

        // Create preview HTML
        let preview_html = `
            <div class="timesheet-preview">
                <h6>${__('Timesheet Preview for Previous Week')}</h6>
                <p class="text-muted">${frappe.format(previous_week_start, 'Date')} to ${frappe.format(previous_week_end, 'Date')}</p>
                <div class="table-responsive">
                    <table class="table table-bordered table-sm">
                        <thead>
                            <tr>
                                <th>${__('Project')}</th>
                                <th>${__('Activity Type')}</th>
                                <th>${__('Sun')}</th>
                                <th>${__('Mon')}</th>
                                <th>${__('Tue')}</th>
                                <th>${__('Wed')}</th>
                                <th>${__('Thu')}</th>
                                <th>${__('Fri')}</th>
                                <th>${__('Sat')}</th>
                                <th>${__('Total')}</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        let total_hours = 0;
        Object.keys(grouped_entries).forEach(key => {
            const entry = grouped_entries[key];
            const row_total = entry.daily_hours.reduce((sum, hours) => sum + hours, 0);
            total_hours += row_total;

            preview_html += `
                <tr>
                    <td>${entry.project_name || '-'}</td>
                    <td>${entry.activity_name || '-'}</td>
            `;

            entry.daily_hours.forEach(hours => {
                preview_html += `<td class="text-center">${hours > 0 ? this.format_hours(hours) : '-'}</td>`;
            });

            preview_html += `<td class="text-center"><strong>${this.format_hours(row_total)}</strong></td></tr>`;
        });

        preview_html += `
                        </tbody>
                        <tfoot>
                            <tr class="font-weight-bold">
                                <td colspan="9">${__('Total Hours')}</td>
                                <td class="text-center">${this.format_hours(total_hours)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div class="mt-3">
                    <small class="text-muted">
                        <strong>${__('Note:')}</strong> ${__('This will copy all time entries from the previous week to the current week. Existing entries for the current week will be preserved.')}
                    </small>
                </div>
            </div>
        `;

        // Show confirmation dialog
        const d = frappe.msgprint({
            title: __('Copy Previous Week Timesheet'),
            message: preview_html,
            wide: true,
            primary_action: {
                label: __('Copy Timesheet'),
                action: () => {
                    d.hide();
                    this.perform_copy_previous_week(grouped_entries);
                }
            },
            secondary_action: {
                label: __('Cancel'),
                action: () => {
                    d.hide();
                }
            }
        });
    }

    group_timesheet_entries_for_preview(timesheets, date_range) {
        const grouped = {};

        timesheets.forEach(entry => {
            const key = `${entry.project || ''}-${entry.task || ''}-${entry.activity_type || ''}`;

            if (!grouped[key]) {
                grouped[key] = {
                    project: entry.project,
                    project_name: entry.project_name,
                    task: entry.task,
                    task_name: entry.task_name,
                    activity_type: entry.activity_type,
                    activity_name: entry.activity_name,
                    is_billable: entry.is_billable,
                    description: entry.description || '',
                    daily_hours: [0, 0, 0, 0, 0, 0, 0],
                    notes: ['', '', '', '', '', '', '']
                };
            }

            // Calculate which day of week this entry belongs to
            const entry_date = new Date(entry.from_time);
            const start_date = new Date(date_range.start_date);
            const day_diff = Math.floor((entry_date - start_date) / (1000 * 60 * 60 * 24));

            if (day_diff >= 0 && day_diff < 7) {
                grouped[key].daily_hours[day_diff] += entry.hours || 0;
                if (entry.description) {
                    grouped[key].notes[day_diff] = entry.description;
                }
            }
        });

        return grouped;
    }

    perform_copy_previous_week(previous_week_entries) {
        // Clear current grid except for header
        $('#timesheet-rows').empty();

        // Add each previous week entry as a new row
        Object.keys(previous_week_entries).forEach(key => {
            const entry = previous_week_entries[key];
            this.add_task_row(entry);
        });

        // Add empty row for new entries
        this.add_new_task_row();

        // Recalculate totals
        this.calculate_totals();

        // Force dimensions for all rows after grid is populated
        this.force_all_actions_column_dimensions();

        // Show success message
        frappe.show_alert({
            message: __('Previous week timesheet copied successfully'),
            indicator: 'green'
        });
    }

    setup_instant_tooltip(icon) {
        const tooltip = $(`
            <div class="custom-tooltip" style="
                position: absolute;
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                z-index: 10000;
                display: none;
                pointer-events: none;
                max-width: 200px;
                word-wrap: break-word;
                white-space: pre-wrap;
            "></div>
        `);

        $('body').append(tooltip);

        icon.on('mouseenter', (e) => {
            const description = icon.data('description') || __('Click to add description');
            if (description && description.trim()) {
                tooltip.text(description);

                const iconOffset = icon.offset();
                const iconWidth = icon.outerWidth();
                const iconHeight = icon.outerHeight();

                // Position tooltip above the icon
                tooltip.css({
                    'left': iconOffset.left + (iconWidth / 2) - (tooltip.outerWidth() / 2) + 'px',
                    'top': iconOffset.top - tooltip.outerHeight() - 5 + 'px',
                    'display': 'block'
                });
            }
        });

        icon.on('mouseleave', () => {
            tooltip.hide();
        });

        // Clean up tooltip when row is removed
        icon.closest('tr').on('remove', () => {
            tooltip.remove();
        });
    }

    mark_as_changed() {
        // Don't mark as changed if timesheet is submitted or cancelled
        if (this.current_docstatus !== 0) {
            return;
        }

        // Only mark as changed if there are actual meaningful changes
        if (!this.has_meaningful_changes()) {
            return;
        }

        // Set the flag and show yellow indicator above status
        this.has_unsaved_changes = true;
        $('#unsaved-changes-indicator').fadeIn(300);
    }

    has_meaningful_changes() {
        // Check if there are any actual time entries or selections
        let has_time_entries = false;
        let has_selections = false;

        // Check for time entries
        $('#timesheet-rows .time-input').each((i, input) => {
            const value = $(input).val();
            if (value && value.trim() && value !== '0:00') {
                has_time_entries = true;
                return false; // break
            }
        });

        // Check for project/activity selections
        $('#timesheet-rows .project-value, #timesheet-rows .activity-value').each((i, input) => {
            const value = $(input).val();
            if (value && value.trim()) {
                has_selections = true;
                return false; // break
            }
        });

        // Only consider it a meaningful change if there's actual data
        return has_time_entries || has_selections;
    }

    mark_as_saved() {
        // Clear the flag and hide yellow indicator
        this.has_unsaved_changes = false;
        $('#unsaved-changes-indicator').fadeOut(300);
    }

    cleanup() {
        // Clean up when page is destroyed
        this.has_unsaved_changes = false;
    }

    update_ui_for_submission_status() {
        // Hide all action buttons first
        $('#submission-actions').hide();
        $('#amend-timesheet-btn, #cancel-timesheet-btn').hide();

        if (this.current_docstatus === 1) {
            // Submitted timesheet - show cancel button only
            $('#submission-actions').show();
            $('#cancel-timesheet-btn').show();

            // Hide save/submit buttons for submitted timesheets
            $('#save-btn, #submit-weekly-btn').hide();

            // Disable all form inputs
            this.disable_all_inputs();

            // Hide copy previous week button
            $('#copy-previous-week-btn').hide();

            // Add read-only visual styling
            $('.timesheet-grid').addClass('readonly-timesheet');

        } else if (this.current_docstatus === 2) {
            // Cancelled timesheet - show amend button only
            $('#submission-actions').show();
            $('#amend-timesheet-btn').show();

            // Hide save/submit buttons for cancelled timesheets
            $('#save-btn, #submit-weekly-btn').hide();

            // Disable all form inputs
            this.disable_all_inputs();

            // Hide copy previous week button
            $('#copy-previous-week-btn').hide();

            // Add read-only visual styling
            $('.timesheet-grid').addClass('readonly-timesheet');

        } else {
            // Draft timesheet (docstatus = 0) - normal editing mode
            $('#submission-actions').hide();

            // Show save/submit buttons for draft timesheets
            $('#save-btn, #submit-weekly-btn').show();

            // Enable all form inputs
            this.enable_all_inputs();

            // Show copy previous week button
            $('#copy-previous-week-btn').show();

            // Remove read-only visual styling
            $('.timesheet-grid').removeClass('readonly-timesheet');
        }
    }

    disable_all_inputs() {
        // Disable time inputs
        $('.time-input').prop('disabled', true).addClass('readonly-input');

        // Disable project and activity dropdowns
        $('.project-search, .activity-search').prop('disabled', true).addClass('readonly-input');

        // Disable description icons
        $('.time-description-icon').addClass('disabled-icon').off('click');

        // Disable add entry button
        $('#add-task-btn').prop('disabled', true);

        // Disable remove row buttons
        $('.remove-row').prop('disabled', true).addClass('disabled-btn');
    }

    enable_all_inputs() {
        // Enable time inputs
        $('.time-input').prop('disabled', false).removeClass('readonly-input');

        // Enable project and activity dropdowns
        $('.project-search, .activity-search').prop('disabled', false).removeClass('readonly-input');

        // Enable description icons (re-setup click handlers)
        $('.time-description-icon').removeClass('disabled-icon');
        this.setup_description_handlers();

        // Enable add entry button
        $('#add-task-btn').prop('disabled', false);

        // Enable remove row buttons
        $('.remove-row').prop('disabled', false).removeClass('disabled-btn');
    }

    setup_description_handlers() {
        // Re-setup description icon click handlers
        $('.time-description-icon').off('click').on('click', (e) => {
            if (this.current_docstatus === 0) {
                this.handle_description_edit($(e.target));
            }
        });
    }

    amend_timesheet() {
        if (!this.current_timesheet) {
            frappe.msgprint(__('No timesheet to amend'));
            return;
        }

        frappe.confirm(__('Are you sure you want to amend this timesheet? This will create a new draft copy.'), () => {
            frappe.call({
                method: 'project_addons.project_addons.api.timesheet.amend_timesheet',
                args: {
                    timesheet_name: this.current_timesheet
                },
                callback: (r) => {
                    if (r.message) {
                        frappe.show_alert({
                            message: __('Timesheet amended successfully. You can now edit the new draft.'),
                            indicator: 'green'
                        });

                        // Update current timesheet reference to the new amended one
                        this.current_timesheet = r.message.name;
                        this.current_docstatus = 0;
                        this.is_submitted = false;

                        // Update the week selection to match the amended timesheet
                        if (r.message.start_date) {
                            $('#week-start-date').val(r.message.start_date);
                        }

                        // Update UI immediately to show draft state
                        this.update_ui_for_submission_status();
                        this.update_status_indicator('Draft', 0);
                        this.update_timesheet_id_display(r.message.name);

                        // Reload data to show the amended timesheet data
                        this.load_data();
                    }
                }
            });
        });
    }

    cancel_timesheet() {
        if (!this.current_timesheet) {
            frappe.msgprint(__('No timesheet to cancel'));
            return;
        }

        frappe.confirm(__('Are you sure you want to cancel this timesheet? This action cannot be undone.'), () => {
            frappe.call({
                method: 'project_addons.project_addons.api.timesheet.cancel_timesheet',
                args: {
                    timesheet_name: this.current_timesheet
                },
                callback: (r) => {
                    if (r.message) {
                        frappe.show_alert({
                            message: __('Timesheet cancelled successfully'),
                            indicator: 'orange'
                        });

                        // Update status
                        this.current_docstatus = 2;
                        this.is_submitted = false;

                        // Update UI immediately
                        this.update_ui_for_submission_status();
                        this.update_status_indicator('Cancelled', 2);
                        this.update_timesheet_id_display(this.current_timesheet);

                        // Reload data to reflect cancellation
                        this.load_data();
                    }
                }
            });
        });
    }

    update_timesheet_id_display(timesheet_id) {
        if (timesheet_id) {
            $('#timesheet-id').text(timesheet_id);
            $('#timesheet-id-display').show();
        } else {
            $('#timesheet-id-display').hide();
        }
    }

    apply_leave() {
        frappe.msgprint(__('Apply leave functionality will be implemented'));
    }

    update_status_indicator(status, docstatus) {
        const indicator = $('#status-indicator');

        // Remove existing classes
        indicator.removeClass('gray orange green red');

        if (docstatus === 1) {
            indicator.addClass('green').text(__('Submitted'));
        } else if (docstatus === 0 && status) {
            indicator.addClass('orange').text(status);
        } else if (docstatus === 2) {
            indicator.addClass('red').text(__('Cancelled'));
        } else {
            indicator.addClass('gray').text(__('Draft'));
        }
    }

    render_add_entry_section(container) {
        // This section is now integrated into the grid footer
    }

    setup_dimension_monitoring() {
        // Monitor and fix dimensions every 100ms for the first 5 seconds
        let monitorCount = 0;
        const maxMonitors = 50; // 5 seconds at 100ms intervals

        const dimensionMonitor = setInterval(() => {
            this.force_all_actions_column_dimensions();
            monitorCount++;

            if (monitorCount >= maxMonitors) {
                clearInterval(dimensionMonitor);
            }
        }, 100);

        // Also monitor on window resize
        $(window).on('resize', () => {
            this.force_all_actions_column_dimensions();
        });

        // Monitor on any DOM changes
        const observer = new MutationObserver(() => {
            this.force_all_actions_column_dimensions();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    force_all_actions_column_dimensions() {
        // Force dimensions for all actions-header cells
        $('.actions-header').css({
            'width': '35px',
            'min-width': '35px',
            'max-width': '35px',
            'padding': '4px',
            'overflow': 'hidden',
            'box-sizing': 'border-box'
        });
    }
}
