import React, { useState, useCallback, FunctionComponent } from 'react'
import * as H from 'history'

import { requestGraphQL } from '../../../backend/graphql'
import { dataOrThrowErrors, gql } from '../../../../../shared/src/graphql/graphql'
import {
    UserEmailsResult,
    RemoveUserEmailResult,
    RemoveUserEmailVariables,
    SetUserEmailVerifiedResult,
    SetUserEmailVerifiedVariables,
    ResendVerificationEmailResult,
    ResendVerificationEmailVariables,
} from '../../../graphql-operations'
import { asError, ErrorLike, isErrorLike } from '../../../../../shared/src/util/errors'
import { eventLogger } from '../../../tracking/eventLogger'

import { ErrorAlert } from '../../../components/alerts'

interface Props {
    user: string
    email: NonNullable<UserEmailsResult['node']>['emails'][number]
    history: H.History

    onError?: (error: ErrorLike) => void
    onDidRemove?: (email: string) => void
    onEmailVerify?: () => void
    onEmailResendVerification?: () => void
}

type Status = undefined | 'loading' | ErrorLike

export const UserEmail: FunctionComponent<Props> = ({
    user,
    email: { email, isPrimary, verified, verificationPending, viewerCanManuallyVerify },
    onError,
    onDidRemove,
    onEmailVerify,
    onEmailResendVerification,
    history,
}) => {
    const [statusOrError, setStatusOrError] = useState<Status>()

    const handleError = useCallback(
        (error: ErrorLike): void => {
            const emailError = asError(error)
            if (onError) {
                onError(emailError)
                setStatusOrError(undefined)
            } else {
                setStatusOrError(emailError)
            }
        },
        [onError]
    )

    const removeEmail = useCallback(async (): Promise<void> => {
        setStatusOrError('loading')

        try {
            dataOrThrowErrors(
                await requestGraphQL<RemoveUserEmailResult, RemoveUserEmailVariables>(
                    gql`
                        mutation RemoveUserEmail($user: ID!, $email: String!) {
                            removeUserEmail(user: $user, email: $email) {
                                alwaysNil
                            }
                        }
                    `,
                    { user, email }
                ).toPromise()
            )

            setStatusOrError(undefined)
            eventLogger.log('UserEmailAddressDeleted')

            if (onDidRemove) {
                onDidRemove(email)
            }
        } catch (error) {
            handleError(error)
        }
    }, [email, user, onDidRemove, handleError])

    const updateEmailVerification = async (verified: boolean): Promise<void> => {
        setStatusOrError('loading')

        try {
            dataOrThrowErrors(
                await requestGraphQL<SetUserEmailVerifiedResult, SetUserEmailVerifiedVariables>(
                    gql`
                        mutation SetUserEmailVerified($user: ID!, $email: String!, $verified: Boolean!) {
                            setUserEmailVerified(user: $user, email: $email, verified: $verified) {
                                alwaysNil
                            }
                        }
                    `,
                    { user, email, verified }
                ).toPromise()
            )

            setStatusOrError(undefined)

            if (verified) {
                eventLogger.log('UserEmailAddressMarkedVerified')
            } else {
                eventLogger.log('UserEmailAddressMarkedUnverified')
            }

            if (onEmailVerify) {
                onEmailVerify()
            }
        } catch (error) {
            handleError(error)
        }
    }

    const resendEmailVerification = async (email: string): Promise<void> => {
        setStatusOrError('loading')

        try {
            dataOrThrowErrors(
                await requestGraphQL<ResendVerificationEmailResult, ResendVerificationEmailVariables>(
                    gql`
                        mutation ResendVerificationEmail($user: ID!, $email: String!) {
                            resendVerificationEmail(user: $user, email: $email) {
                                alwaysNil
                            }
                        }
                    `,
                    { user, email }
                ).toPromise()
            )

            setStatusOrError(undefined)
            eventLogger.log('UserEmailAddressVerificationResent')

            if (onEmailResendVerification) {
                onEmailResendVerification()
            }
        } catch (error) {
            handleError(error)
        }
    }

    return (
        <>
            <div className="d-flex align-items-center justify-content-between">
                <div>
                    <span className="mr-2">{email}</span>
                    {verified ? (
                        <span className="badge badge-success mr-1">Verified</span>
                    ) : verificationPending ? (
                        <span>
                            &bull;{' '}
                            <button
                                type="button"
                                className="btn btn-link text-primary p-0 mr-1"
                                onClick={() => resendEmailVerification(email)}
                                disabled={statusOrError === 'loading'}
                            >
                                Resend verification email
                            </button>
                        </span>
                    ) : (
                        <span className="badge badge-secondary mr-1">Not verified</span>
                    )}
                    {isPrimary && <span className="badge badge-primary">Primary</span>}
                </div>
                <div>
                    {viewerCanManuallyVerify && (
                        <button
                            type="button"
                            className="btn btn-link text-primary p-0"
                            onClick={() => updateEmailVerification(!verified)}
                            disabled={statusOrError === 'loading'}
                        >
                            {verified ? 'Mark as unverified' : 'Mark as verified'}
                        </button>
                    )}{' '}
                    {!isPrimary && (
                        <button
                            type="button"
                            className="btn btn-link text-danger p-0"
                            onClick={removeEmail}
                            disabled={statusOrError === 'loading'}
                        >
                            Remove
                        </button>
                    )}
                </div>
            </div>
            {isErrorLike(statusOrError) && <ErrorAlert className="mt-2" error={statusOrError} history={history} />}
        </>
    )
}
