interface FormField {
	key: string;
	label: string;
	type:
		| "text"
		| "textarea"
		| "number"
		| "email"
		| "select"
		| "date"
		| "datetime"
		| "password"
		| "checkboxes"
		| "search"
		| "file";
	required?: boolean;
	placeholder?: string;
	options?: Array<{ label: string; value: string }>;
	[key: string]: unknown;
}

export function textField(
	key: string,
	label: string,
	opts: { required?: boolean; placeholder?: string } = {},
): FormField {
	return { key, label, type: "text", ...opts };
}

export function textareaField(
	key: string,
	label: string,
	opts: { required?: boolean } = {},
): FormField {
	return { key, label, type: "textarea", ...opts };
}

export function numberField(
	key: string,
	label: string,
	opts: { required?: boolean } = {},
): FormField {
	return { key, label, type: "number", ...opts };
}

export function selectField(
	key: string,
	label: string,
	options: Array<{ label: string; value: string }>,
	opts: { required?: boolean } = {},
): FormField {
	return { key, label, type: "select", options, ...opts };
}

export function datetimeField(
	key: string,
	label: string,
	opts: { required?: boolean } = {},
): FormField {
	return { key, label, type: "datetime", ...opts };
}

export function dateField(
	key: string,
	label: string,
	opts: { required?: boolean } = {},
): FormField {
	return { key, label, type: "date", ...opts };
}

export function emailField(
	key: string,
	label: string,
	opts: { required?: boolean } = {},
): FormField {
	return { key, label, type: "email", ...opts };
}

export function checkboxesField(
	key: string,
	label: string,
	options: Array<{ label: string; value: string }>,
): FormField {
	return { key, label, type: "checkboxes", options };
}
