# Address Picker Edit Mode

## Goal
Add per-row "edit" capability to `AddressBookPickerDialog` (the address "select mode" component) so users can edit a saved address directly from the picker; on save the list refreshes. Benefits all 4 pages that use the picker (drop-shipping order / order-label / return / print-label create).

## Decisions (confirmed)
- **Self-contained edit in the picker**: the picker embeds `AddressFormDialog`, loads countries itself, calls `/order/editAddr`, then emits `load-page` so the parent's existing handler reloads the list.
- **After edit**: only reload the list (no auto-select).
- **Country**: freely editable in the edit form (do NOT apply `countryLock` to the embedded edit dialog).
- **addrType**: new prop, default `2` (receiver). print-label overrides per target.

## Reference implementations to mirror
- Form population from a row → `src/pages/apps/account/address-management.vue` `openEdit(row)` (lines ~107-124).
- Edit submit payload + `/order/editAddr` → `address-management.vue` `submitForm()` (lines ~183-225).
- Country load + mapping → `address-management.vue` `loadCountries()` and `countryItems` computed (lines ~62-67, ~126-146).
- Edit-mode form dialog props → already supported by `src/components/address/AddressFormDialog.vue` (`isEdit`, `editingId`, title/button switching).

## Files to change

### 1. `src/components/address/AddressBookPickerDialog.vue` (core)
Script:
- Add imports: `import { $api } from '@/utils/api'` and `import AddressFormDialog from '@/components/address/AddressFormDialog.vue'` (other composables like `ref`/`computed`/`useCookie`/`useI18n`/`nextTick` are Nuxt auto-imports).
- Add prop: `addrType: { type: Number, default: 2, validator: v => v === 1 || v === 2 }`.
- Keep existing emits; `load-page` is reused as the reload signal after edit (already declared).
- Internal state: `editDialog` (bool), `editForm` (object), `editEditingId` (string), `editSubmitting` (bool), `editCountries` (array), `editCountriesLoaded` (bool), plus a snackbar ref `{ show, text, color }` and a `toast()` helper.
- `editCountryItems` computed: mirror address-management mapping
  `countries.value.map(item => ({ title: [item.short_name, item.en_name, item.cn_name].filter(Boolean).join(' - ') || item.short_name || item.cn_name || item.en_name, value: item.short_name || item.cn_name || item.en_name }))`.
- `loadEditCountries()`: lazy; if `editCountriesLoaded` return; call `POST /order/queryCountry` with `{}`; store array; on fail toast + empty list.
- `openAddrEdit(row)`:
  - Guard: if no `row.id` → warning toast, return.
  - Populate `editForm` exactly like `openEdit`: `name`, `country: row.country_code || row.country || ''`, `province`, `city`, `streetno: row.streetno || row.street_no || ''`, `address`, `address2: row.address2 || row.address_2 || ''`, `email: row.email || ''`, `postcode`, `telephone: row.telephone || row.phone || ''`, `company`.
  - `editEditingId = String(row.id)`.
  - `await loadEditCountries()`.
  - `editDialog = true`.
- `submitAddrEdit()`:
  - Build payload: trimmed fields from `editForm` (name/country/province/city/streetno/address/address2/email/postcode/telephone/company) + `type: Number(props.addrType)` + `token: useCookie('accessToken').value || ''` + `id: String(editEditingId)`.
  - `editSubmitting = true`; `POST /order/editAddr` via `$api`.
  - On `code === 1`: close `editDialog`, `emit('load-page')`, success toast.
  - Else: error toast (`res?.msg` fallback).
  - Catch: error toast (`e?.data?.msg || e?.message`).
  - Finally: `editSubmitting = false`.

Template:
- In `#item.actions`, add an edit `IconBtn` (icon `tabler-pencil`, size small, color secondary/primary) with a `VTooltip` BEFORE the existing "选择" button; `@click.stop="openAddrEdit(item)"`.
- Widen the actions column header: `width: '96'` → `'120'` (keep `align: 'end'`).
- Add embedded `<AddressFormDialog>` after the `VDataTable` (inside the `VCard`):
  `v-model="editDialog"`, `v-model:form="editForm"`, `:addr-type="addrType"`, `:is-edit="true"`, `:editing-id="editEditingId"`, `:country-items="editCountryItems"`, `:countries-loading="editCountriesLoading"` (add this ref or reuse a derived bool), `:submitting="editSubmitting"`, `@submit="submitAddrEdit"`. Do NOT pass `countryLock`.
- Add a `<VSnackbar v-model="snack.show" :color="snack.color" location="top" :timeout="2600">{{ snack.text }}</VSnackbar>`.

### 2. `src/pages/apps/print-label/create.vue` (only parent change)
- On `<AddressBookPickerDialog>` (around line 884) add `:addr-type="addrDialogTarget === 'sender' ? 1 : 2"`.
- Reason: print-label opens the picker for both sender (type 1) and receiver (type 2); default `2` would misclassify edited sender addresses.

### 3. i18n — add to `components.addressBookPicker` in all three locales
- `src/plugins/i18n/locales/zh.json`: `edit`="编辑", `editSuccess`="地址已更新", `editFailed`="地址更新失败", `countryLoadFailed`="国家列表加载失败".
- `src/plugins/i18n/locales/en.json`: `edit`="Edit", `editSuccess`="Address updated", `editFailed`="Failed to update address", `countryLoadFailed`="Failed to load countries".
- `src/plugins/i18n/locales/fr.json`: `edit`="Éditer", `editSuccess`="Adresse mise à jour", `editFailed`="Échec de la mise à jour de l'adresse", `countryLoadFailed`="Échec du chargement des pays".
- Insert keys right after the existing `select` key to keep grouping.

## Not changed (use defaults)
- `drop-shipping/order/create.vue`, `drop-shipping/order-label/create.vue`, `drop-shipping/return/order-create.vue`: all query/save addresses with `type: 2`, so the picker default `addrType=2` is correct — no edits needed.

## Edge cases / risks
- Nested dialog (picker `VDialog` > edit `AddressFormDialog`): Vuetify teleports the inner dialog to `body`; it should overlay on top. Verify visually that it appears above the picker and that closing the edit dialog returns focus/state to the picker without closing the picker.
- `row.id` missing → skip edit with warning toast.
- Country load failure → edit form still opens with an empty country dropdown + error toast (acceptable).
- Do NOT pass `countryLock` to the embedded edit dialog (book-entry editing should allow country changes).
- After edit, parent reloads the current page via existing `@load-page="loadAddrList"`; the edited row remains visible if it is on the current page.
- The return-order page's create uses `$apiJson` for `/order/addAddr`, but the picker's edit standardizes on `$api` (matches `address-management` and `print-label` edit paths). Confirm edit works for return-order context too.

## Validation
- drop-shipping order create: open picker → edit a row → change a field → save → list refreshes with new value; "选择" still works; receiver not auto-changed.
- print-label: open picker for sender → edit a row → confirm saved as type 1 (still appears in sender list); repeat for receiver → type 2.
- Verify nested dialog overlay/close + no double-overlay residue.
- Run the project's lint/typecheck command (e.g. `npm run lint`) before finishing.
