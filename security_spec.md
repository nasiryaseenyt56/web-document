# Firestore Security Specification

## 1. Data Invariants
1. **User Identity & PII Isolation**: Users may only read and write their own profile document (`/users/{userId}`). Self-escalation of roles is forbidden.
2. **Admin Authorization**: Only authenticated users whose UID or email matches the trusted administrator list (`/admins/{uid}` or runtime bootstrap `nasiryaseen2011@gmail.com`) have admin privileges.
3. **Item Catalog Integrity**: Public users can read published items (`status == 'published'`). Only admins can create, update, or delete items.
4. **Order Integrity & Verification**:
   - Buyers can create orders only for themselves (`incoming().user_id == request.auth.uid`).
   - The initial status on creation MUST be `'pending'`.
   - Only admins can change status from `'pending'` to `'verified'` or update the order's `verified_at` timestamp.
   - Buyers can only read their own orders. Admins can read all orders.
5. **Store Settings**: Anyone can read store settings (to know the WhatsApp number for verification), but only admins can update settings.
6. **ID & String Boundaries**: All document IDs and string attributes must pass strict length and character guards to prevent Denial of Wallet.

## 2. The "Dirty Dozen" Payloads
1. **Payload 1 (Privilege Escalation)**: Unauthenticated or non-admin user attempts to create an item in `/items`. (Expected: PERMISSION_DENIED)
2. **Payload 2 (Self-Verification)**: Buyer attempts to create an order with `status: "verified"`. (Expected: PERMISSION_DENIED)
3. **Payload 3 (Order Status Tampering)**: Non-admin buyer attempts to update `status` of their own order from "pending" to "verified". (Expected: PERMISSION_DENIED)
4. **Payload 4 (Ghost Order Creation)**: Buyer creates order with `user_id` set to someone else's UID. (Expected: PERMISSION_DENIED)
5. **Payload 5 (Cross-User Order Snooping)**: Buyer queries or gets another user's order. (Expected: PERMISSION_DENIED)
6. **Payload 6 (Unauthorized Deletion)**: Non-admin buyer attempts to delete an item in `/items`. (Expected: PERMISSION_DENIED)
7. **Payload 7 (Settings Override)**: Non-admin attempts to change `admin_whatsapp` or bank accounts in `/settings/global`. (Expected: PERMISSION_DENIED)
8. **Payload 8 (Admin Impersonation via Profile)**: User creates `/users/{uid}` with `role: "admin"`. (Expected: PERMISSION_DENIED)
9. **Payload 9 (Oversized Payload / Wallet Attack)**: Item creation with 5MB title or description string. (Expected: PERMISSION_DENIED)
10. **Payload 10 (Draft Item Leak)**: Non-admin queries items where `status == 'draft'`. (Expected: PERMISSION_DENIED)
11. **Payload 11 (Orphaned Order)**: Non-admin creates order with missing `item_id` or invalid transfer reference. (Expected: PERMISSION_DENIED)
12. **Payload 12 (Immutable Field Tampering)**: Attempt to overwrite `created_at` or `user_id` on existing order. (Expected: PERMISSION_DENIED)
