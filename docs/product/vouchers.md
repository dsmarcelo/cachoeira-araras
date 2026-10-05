# Purchases and entry

Visitors buy full-price or half-price entries, with or without pool access, for a chosen Visit Date. A purchase needs at least one entry. Quantities must be nonnegative whole numbers and stay within each category's configured limit.

The booking window runs from today through the configured number of days ahead, inclusive, using São Paulo dates. Closed dates and disabled entry categories cannot be purchased. Defaults allow 60 days ahead and 20 entries per category; these are purchase limits, not a guarantee of daily venue capacity.

Prices are configured separately for standard and pool entries. Half-price quantities cost half the corresponding full price, rounded to cents per category. The accepted purchase total is fixed when checkout starts; later price changes do not reprice existing purchases.

A phone number can have one unexpired Pending purchase at a time. Visitors can resume or cancel that purchase using the saved purchase access. If payment approval wins the cancellation race, the purchase remains paid. Approval arriving after completed cancellation is refunded.

## Rescheduling

A Reschedule moves a Voucher to another Visit Date and always moves its Expiry to the end of the new São Paulo day. Price, quantities and payments never change. Only the last Reschedule is kept: when it happened and who made it (the customer or a named admin).

Customers can reschedule a Pending or Valid Voucher that has not expired, as often as they like, to any day a purchase would allow. Admins can also reschedule an Expired Voucher, which becomes Valid again, to any day from today on, ignoring the booking window and closed days. Employees cannot reschedule.

## Entry

Staff look up the Voucher Code and record entry once. Redemption requires a Valid Voucher whose current Visit Date is today in São Paulo. Pending, overdue, cancelled and refunded purchases do not grant entry through the ordinary purchase flow.

Staff can reactivate a Voucher and extend its Expiry to the end of today; cancellation cannot be undone this way. Reactivation does not change the Visit Date. It does not bypass the gate's same-date requirement, so extending an older Voucher alone does not make it redeemable today.

Unused Valid Vouchers become Expired during daily maintenance. Overdue Pending purchases are hidden from active views but retained. Real Vouchers are not physically deleted by daily maintenance. Test Vouchers are deleted after 30 days.

## Voucher image

Customers see their voucher image in Meus Vouchers once paid. Admins can view, download and send the same image for any voucher that is not Pending or deleted. Sending opens the device's share options, or the customer's WhatsApp chat with the image downloaded for attaching; the app never sends messages itself.
