import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'

// Initialize pool lazily to avoid build-time errors
let userPool: CognitoUserPool | null = null

const getUserPool = () => {
  if (!userPool) {
    const poolData = {
      UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    }
    
    if (!poolData.UserPoolId || !poolData.ClientId) {
      console.warn('Cognito credentials not configured')
      throw new Error('Cognito configuration missing')
    }
    
    userPool = new CognitoUserPool(poolData)
  }
  return userPool
}

export interface AuthResponse {
  success: boolean
  session?: CognitoUserSession
  error?: string
}

export const signIn = async (email: string, password: string): Promise<AuthResponse> => {
  return new Promise((resolve) => {
    try {
      const pool = getUserPool()
      
      const authenticationData = {
        Username: email,
        Password: password,
      }

      const authenticationDetails = new AuthenticationDetails(authenticationData)

      const userData = {
        Username: email,
        Pool: pool,
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
    } catch (error: any) {
      resolve({ success: false, error: error.message })
    }
  })
}

export const signUp = async (
  email: string,
  password: string,
  name: string
): Promise<AuthResponse> => {
  return new Promise((resolve) => {
    try {
      const pool = getUserPool()
      
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
      pool.signUp(email, password, attributeList as any, [], (err, result) => {
        if (err) {
          resolve({ success: false, error: err.message })
          return
        }
        resolve({ success: true })
      })
    } catch (error: any) {
      resolve({ success: false, error: error.message })
    }
  })
}

export const signOut = () => {
  try {
    const pool = getUserPool()
    const cognitoUser = pool.getCurrentUser()
    if (cognitoUser) {
      cognitoUser.signOut()
    }
  } catch (error) {
    console.warn('Error signing out:', error)
  }
  localStorage.removeItem('access_token')
  localStorage.removeItem('id_token')
  localStorage.removeItem('refresh_token')
}

export const getCurrentUser = (): CognitoUser | null => {
  try {
    const pool = getUserPool()
    return pool.getCurrentUser()
  } catch (error) {
    return null
  }
}

export const getSession = (): Promise<CognitoUserSession | null> => {
  return new Promise((resolve) => {
    try {
      const pool = getUserPool()
      const cognitoUser = pool.getCurrentUser()

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
    } catch (error) {
      resolve(null)
    }
  })
}

export const isAuthenticated = async (): Promise<boolean> => {
  const session = await getSession()
  return session?.isValid() || false
}

