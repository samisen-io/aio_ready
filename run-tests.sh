#!/bin/bash

# AIO Audit Tool - Test Runner Script
# This script provides various testing options with colored output

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if dependencies are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    if [ ! -d "node_modules" ]; then
        print_warning "Node modules not found. Installing dependencies..."
        npm install
        if [ $? -ne 0 ]; then
            print_error "Failed to install dependencies"
            exit 1
        fi
    fi
    
    print_success "Dependencies are ready"
}

# Function to run linting
run_lint() {
    print_status "Running ESLint..."
    npm run lint
    if [ $? -eq 0 ]; then
        print_success "Linting passed"
        return 0
    else
        print_error "Linting failed"
        return 1
    fi
}

# Function to run unit tests
run_unit_tests() {
    print_status "Running unit tests..."
    npm run test:unit
    if [ $? -eq 0 ]; then
        print_success "Unit tests passed"
        return 0
    else
        print_error "Unit tests failed"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    npm run test:integration
    if [ $? -eq 0 ]; then
        print_success "Integration tests passed"
        return 0
    else
        print_error "Integration tests failed"
        return 1
    fi
}

# Function to run all tests with coverage
run_all_tests() {
    print_status "Running all tests with coverage..."
    npm run test:coverage
    if [ $? -eq 0 ]; then
        print_success "All tests passed"
        return 0
    else
        print_error "Some tests failed"
        return 1
    fi
}

# Function to run tests in CI mode
run_ci_tests() {
    print_status "Running tests in CI mode..."
    npm run test:ci
    if [ $? -eq 0 ]; then
        print_success "CI tests passed"
        return 0
    else
        print_error "CI tests failed"
        return 1
    fi
}

# Function to display coverage report
show_coverage() {
    if [ -f "coverage/lcov-report/index.html" ]; then
        print_status "Opening coverage report in browser..."
        if command -v open &> /dev/null; then
            open coverage/lcov-report/index.html
        elif command -v xdg-open &> /dev/null; then
            xdg-open coverage/lcov-report/index.html
        else
            print_warning "Cannot open browser automatically. Coverage report is at: coverage/lcov-report/index.html"
        fi
    else
        print_warning "Coverage report not found. Run tests with coverage first."
    fi
}

# Function to clean test artifacts
clean_test_artifacts() {
    print_status "Cleaning test artifacts..."
    rm -rf coverage/
    rm -rf .nyc_output/
    print_success "Test artifacts cleaned"
}

# Function to setup test environment
setup_test_env() {
    print_status "Setting up test environment..."
    
    # Create test directories if they don't exist
    mkdir -p tests/unit tests/integration coverage
    
    # Set test environment variables
    export NODE_ENV=test
    export PORT=3001
    
    print_success "Test environment ready"
}

# Function to watch tests during development
watch_tests() {
    print_status "Starting test watcher..."
    print_warning "Press 'q' to quit, 'a' to run all tests, 'f' to run only failed tests"
    npm run test:watch
}

# Function to display help
show_help() {
    echo -e "${BLUE}AIO Audit Tool - Test Runner${NC}"
    echo ""
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  all         Run all tests with coverage (default)"
    echo "  unit        Run only unit tests"
    echo "  integration Run only integration tests"
    echo "  lint        Run ESLint only"
    echo "  ci          Run tests in CI mode"
    echo "  watch       Run tests in