import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'

const poolData = {
  UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
  ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
}

const userPool = new CognitoUserPool(poolData)

export interface AuthResponse {
  success: boolean
  session?: CognitoUserSession
  error?: string
}

export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  return new Promise((resolve) => {
    const authenticationData = {
      Username: email,
      Password: password,
    }

    const authenticationDetails = new AuthenticationDetails(authenticationData)

    const userData = {
      Username: email,
      Pool: userPool,
    }

    const cognitoUser = new CognitoUser(userData)

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (session) => {
        // Store tokens
        localStorage.setItem('access_token', session.getAccessToken().getJwtToken())
        localStorage.setItem('id_token', session.getIdToken().getJwtToken())
        localStorage.setItem('refresh_token', session.getRefreshToken().getToken())

        resolve({ success: true, session })
      },
      onFailure: (err) => {
        resolve({ success: false, error: err.message })
      },
    })
  })
}

export const signUp = async (
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> => {
  return new Promise((resolve) => {
    const attributeList = [
      {
        Name: 'email',
        Value: email,
      },
      {
        Name: 'name',
        Value: name,
      },
    ]

    // Note: Cognito will auto-create the user. For production, you may want to 
    // use admin-create-user API instead via backend
    userPool.signUp(email, password, attributeList as any, [], (err, result) => {
      if (err) {
        resolve({ success: false, error: err.message })
        return
      }
      resolve({ success: true })
    })
  })
}

export const signOut = () => {
  const cognitoUser = userPool.getCurrentUser()
  if (cognitoUser) {
    cognitoUser.signOut()
  }
  localStorage.removeItem('access_token')
  localStorage.removeItem('id_token')
  localStorage.removeItem('refresh_token')
}

export const getCurrentUser = (): CognitoUser | null => {
  return userPool.getCurrentUser()
}

export const getSession = (): Promise<CognitoUserSession | null> => {
  return new Promise((resolve) => {
    const cognitoUser = userPool.getCurrentUser()

    if (!cognitoUser) {
      resolve(null)
      return
    }

    cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) {
        resolve(null)
        return
      }

      resolve(session)
    })
  })
}

export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getSession()
  return session?.isValid() || false
}

