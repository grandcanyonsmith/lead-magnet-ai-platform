import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
} from 'amazon-cognito-identity-js'

// Initialize pool lazily to avoid build-time errors
let userPool: CognitoUserPool | null = null
let clientId: string | null = null

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
    
    clientId = poolData.ClientId
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
          
          // Store username for getCurrentUser to work
          localStorage.setItem('cognito_username', email)

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
  localStorage.removeItem('cognito_username')
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
      
      // First try to get current user from Cognito SDK
      let cognitoUser = pool.getCurrentUser()
      
      // If no current user, try to get the username from Cognito's storage
      if (!cognitoUser) {
        // Ensure pool is initialized to get clientId
        getUserPool()
        if (!clientId) {
          resolve(null)
          return
        }
        const lastAuthUser = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
        
        if (lastAuthUser) {
          // Use the stored username (could be UUID or email)
          cognitoUser = new CognitoUser({
            Username: lastAuthUser,
            Pool: pool,
          })
        } else {
          // Fallback to stored email
          const username = localStorage.getItem('cognito_username')
          if (username) {
            cognitoUser = new CognitoUser({
              Username: username,
              Pool: pool,
            })
          } else {
            resolve(null)
            return
          }
        }
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          resolve(null)
          return
        }

        resolve(session)
      })
    } catch (error) {
      console.error('Error in getSession:', error)
      resolve(null)
    }
  })
}

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    // First check if we have Cognito tokens stored
    getUserPool() // Ensure pool is initialized
    if (!clientId) {
      return false
    }
    
    // Check for Cognito's LastAuthUser key
    const lastAuthUser = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.LastAuthUser`)
    if (!lastAuthUser) {
      return false
    }
    
    // Check if tokens exist
    const idToken = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.idToken`)
    const accessToken = localStorage.getItem(`CognitoIdentityServiceProvider.${clientId}.${lastAuthUser}.accessToken`)
    
    if (!idToken || !accessToken) {
      return false
    }

    // If we have tokens, consider authenticated
    // We'll let the API handle token expiration/refresh
    // Try to get session but don't fail if it's expired
    try {
      const session = await getSession()
      if (session) {
        return true
      }
    } catch (sessionError) {
      // Session might be expired but tokens exist - still consider authenticated
      // The API will handle token refresh if needed
      console.log('Session check failed but tokens exist:', sessionError)
    }
    
    // If tokens exist, we're authenticated
    return true
  } catch (error) {
    console.error('Error checking authentication:', error)
    return false
  }
}

