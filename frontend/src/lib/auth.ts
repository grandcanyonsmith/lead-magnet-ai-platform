import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js'

// Initialize pool lazily to avoid build-time errors
let userPool: CognitoUserPool | null = null
let clientId: string | null = null

const getUserPool = () => {
  if (!userPool) {
    const userPoolId = (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '').trim()
    const clientIdValue = (process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '').trim()
    
    if (!userPoolId || !clientIdValue) {
      const errorMsg = `Cognito configuration missing. UserPoolId: ${userPoolId ? 'set' : 'missing'}, ClientId: ${clientIdValue ? 'set' : 'missing'}`
      console.error(errorMsg)
      console.error('Environment variables:', {
        NEXT_PUBLIC_COGNITO_USER_POOL_ID: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        NEXT_PUBLIC_COGNITO_CLIENT_ID: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
      })
      throw new Error(errorMsg)
    }
    
    // Validate UserPoolId format (should be like us-east-1_XXXXXXXXX)
    if (!/^[\w-]+_[a-zA-Z0-9]+$/.test(userPoolId)) {
      const errorMsg = `Invalid UserPoolId format: "${userPoolId}". Expected format: region_poolId (e.g., us-east-1_XXXXXXXXX)`
      console.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    const poolData = {
      UserPoolId: userPoolId,
      ClientId: clientIdValue,
    }
    
    clientId = clientIdValue
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
      
      // Use CognitoUserAttribute for proper attribute handling
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
        new CognitoUserAttribute({
          Name: 'name', // Cognito standard attribute - maps to 'fullname'
          Value: name,
        }),
      ]

      // Sign up with auto-confirmation (handled by Lambda trigger)
      pool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          console.error('Signup error:', err)
          // Provide more helpful error messages
          let errorMessage = err.message || 'Failed to sign up'
          if (err.code === 'InvalidParameterException') {
            errorMessage = 'Invalid signup parameters. Please check your email and password requirements.'
          } else if (err.code === 'UsernameExistsException') {
            errorMessage = 'An account with this email already exists. Please sign in instead.'
          } else if (err.code === 'InvalidPasswordException') {
            errorMessage = 'Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, and numbers.'
          }
          resolve({ success: false, error: errorMessage })
          return
        }
        
        // User is auto-confirmed by Lambda trigger, so they can sign in immediately
        console.log('Signup successful, user auto-confirmed')
        resolve({ success: true })
      })
    } catch (error: any) {
      console.error('Signup exception:', error)
      resolve({ success: false, error: error.message || 'An unexpected error occurred during signup' })
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

    // Try to get session to verify token is still valid
    // This will fail if token is expired
    try {
      const session = await getSession()
      if (!session) {
        console.warn('No session found, clearing authentication')
        signOut()
        return false
      }
      
      // Check if session is valid
      if (session.isValid()) {
        // Also verify token hasn't expired
        const idTokenObj = session.getIdToken()
        const exp = idTokenObj.getExpiration()
        const now = Math.floor(Date.now() / 1000)
        if (exp > now) {
          return true
        }
        // Token expired
        console.warn('Token expired, clearing authentication')
        signOut()
        return false
      }
      
      // Session is not valid
      console.warn('Session invalid, clearing authentication')
      signOut()
      return false
    } catch (sessionError: any) {
      // Session check failed - token likely expired or invalid
      console.warn('Session check failed, token may be expired:', sessionError?.message)
      // Clear tokens if session check fails
      signOut()
      return false
    }
  } catch (error) {
    console.error('Error checking authentication:', error)
    return false
  }
}

