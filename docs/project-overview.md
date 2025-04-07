# Mazeway

> This document serves as a memory/overview of the codebase for LLMs. It helps them understand the project structure, key features, and important implementation details.

## Introduction

The open-source auth foundation that lives in your project, not a node_modules folder.

**Core Features**:

- Authentication
  - Email/password
  - Social providers (Google, GitHub)
  - Two-factor authentication (2FA)
  - Password reset flow
  - Device tracking
- Account Security
  - Activity history
  - Security alerts
  - Device management
  - Data export (GDPR)
  - Account deletion
- Verification System
  - 2FA methods
  - Backup codes
  - Password verification
  - Email verification
- API Security
  - Rate limiting
  - CSRF protection
  - Input validation

## Tech Stack

* Next.js 15
* Tailwind
* Shadcn
* Supabase
* Upstash Redis
* Resend

## Core Architecture

### Authentication Layer
- Custom auth flow with Supabase
- Device session tracking
- Social provider integration
- Verification system
- Rate limiting

### Security Layer
- Device trust scoring
- Session management
- Event logging
- Email alerts
- Data protection

### User Management
- Profile system
- Security settings
- Device control
- Data portability
- Account lifecycle

## Project Structure
- `app/`: Next.js app router
- `components/`: React components
- `emails/`: Email templates
- `utils/`: Core utilities
- `config/`: App configuration

## Key Features

### Authentication System
- Multiple sign-in methods
- Enhanced verification flow
- Device tracking
- Session management

### Security Features
- Multi-factor authentication
- Device trust system
- Rate limiting
- Audit logging
- Email alerts

### Account Management
- Profile controls
- Security settings
- Device management
- Data export
- Account deletion

### Email System
- Security alerts
- Verification emails
- Activity notifications

### Data Protection
- GDPR compliance
- Secure exports
- Data cleanup
- Access controls

### API Security
- Request validation
- Rate limiting
- CSRF protection
- Error handling