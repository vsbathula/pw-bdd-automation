# features/saucedemo.feature
Feature: Sauce Demo E-Commerce Application

    Background:
        Given user is on the Sauce Demo login page "/"

    # LOGIN SCENARIOS
    Scenario: Successful login with valid credentials
        When user fill "standard_user" in "username" input
        And user fill "secret_sauce" in "password" input
        And user click "Login" button
        Then user should be redirected to the inventory page

    Scenario: Login fails with invalid credentials
        When user fill "standard_user" in "username" input
        And user fill "wrong_password" in "password" input
        And user click "Login" button
        Then user should see a "username and password do not match any user in this service" message

    Scenario: Locked out user cannot login
        When user fill "locked_out_user" in "username" input
        And user fill "secret_sauce" in "password" input
        And user click "Login" button
        Then user should see a "sorry, this user has been locked out" message

    Scenario: Go to product description page
        When user fill "standard_user" in "username" input
        And user fill "secret_sauce" in "password" input
        And user click "Login" button
        Then user should be redirected to the inventory page
        When user click "inventory" link
        Then user should be redirected to the inventory page

    # PRODUCT & CART SCENARIOS
    Scenario: Add a single product to the cart
        When user fill "standard_user" in "username" input
        And user fill "secret_sauce" in "password" input
        And user click "Login" button
        Then user should be redirected to the inventory page
        When user click "Add to cart" button
        Then user shopping cart should show "1"

# Scenario: Remove product from cart
#     Given the user has added "Sauce Labs Backpack" to the cart
#     When the user removes "Sauce Labs Backpack" from the cart
#     Then the shopping cart badge should not be visible

# Scenario: View cart contents
#     Given the user has added "Sauce Labs Backpack" to the cart
#     When the user opens the shopping cart
#     Then "Sauce Labs Backpack" should be listed in the cart

# # CHECKOUT SCENARIOS
# Scenario: Successful checkout with valid info
#     Given the user has added "Sauce Labs Backpack" to the cart
#     And the user is on the cart page
#     When the user proceeds to checkout
#     And the user enters first name "John", last name "Doe", and postal code "12345"
#     And the user continues to the overview
#     And the user finishes the order
#     Then the user should see an order confirmation message

# Scenario: Checkout fails when fields are missing
#     Given the user has added "Sauce Labs Backpack" to the cart
#     And the user is on the cart page
#     When the user proceeds to checkout
#     And the user leaves postal code blank
#     Then the user should see a checkout error message

# # OPTIONAL BEHAVIOR
# Scenario: Sort products by price low to high
#     Given the user is logged in
#     When the user sorts products by "Price (low to high)"
#     Then the inventory list should be displayed in ascending price order

# Scenario: User logs out
#     Given the user is logged in
#     When the user logs out
#     Then the user should return to the login page
