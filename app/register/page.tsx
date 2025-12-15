"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { SolarLogo } from "@/components/solar-logo"
import { ArrowLeft, ArrowRight, Check, Upload } from "lucide-react"
import { governmentIds, indianStates } from "@/lib/quotation-data"

const steps = [
  { id: 1, name: "Personal" },
  { id: 2, name: "Contact" },
  { id: 3, name: "ID Proof" },
  { id: 4, name: "Address" },
  { id: 5, name: "Security" },
]

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otp, setOtp] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    gender: "",
    dateOfBirth: "",
    fatherName: "",
    fatherContact: "",
    governmentIdType: "",
    governmentIdNumber: "",
    governmentIdImage: "",
    street: "",
    city: "",
    state: "",
    pincode: "",
    password: "",
    confirmPassword: "",
  })

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const validateStep = (): boolean => {
    switch (currentStep) {
      case 1:
        if (
          !formData.username ||
          !formData.firstName ||
          !formData.lastName ||
          !formData.gender ||
          !formData.dateOfBirth
        ) {
          setError("Please fill in all required fields")
          return false
        }
        break
      case 2:
        if (!formData.mobile || !formData.email || !formData.fatherName) {
          setError("Please fill in all required fields")
          return false
        }
        if (!/^\d{10}$/.test(formData.mobile)) {
          setError("Please enter a valid 10-digit mobile number")
          return false
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          setError("Please enter a valid email address")
          return false
        }
        break
      case 3:
        if (!formData.governmentIdType || !formData.governmentIdNumber) {
          setError("Please select ID type and enter ID number")
          return false
        }
        break
      case 4:
        if (!formData.street || !formData.city || !formData.state || !formData.pincode) {
          setError("Please fill in complete address")
          return false
        }
        if (!/^\d{6}$/.test(formData.pincode)) {
          setError("Please enter a valid 6-digit pincode")
          return false
        }
        break
      case 5:
        if (!formData.password || !formData.confirmPassword) {
          setError("Please enter password and confirm password")
          return false
        }
        if (formData.password.length < 8) {
          setError("Password must be at least 8 characters")
          return false
        }
        if (formData.password !== formData.confirmPassword) {
          setError("Passwords do not match")
          return false
        }
        if (!otpVerified) {
          setError("Please verify your mobile number with OTP")
          return false
        }
        if (!agreedToTerms) {
          setError("Please agree to the terms and conditions")
          return false
        }
        break
    }
    return true
  }

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, 5))
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError("")
  }

  const handleSendOtp = () => {
    setOtpSent(true)
    setError("")
  }

  const handleVerifyOtp = () => {
    if (otp.length === 6) {
      setOtpVerified(true)
      setError("")
    } else {
      setError("Please enter a valid 6-digit OTP")
    }
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setIsLoading(true)
    try {
      const success = await register({
        id: `DLR-${Date.now()}`,
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        mobile: formData.mobile,
        email: formData.email,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        fatherName: formData.fatherName,
        fatherContact: formData.fatherContact,
        governmentIdType: formData.governmentIdType,
        governmentIdNumber: formData.governmentIdNumber,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
        },
        password: formData.password,
      })

      if (success) {
        router.push("/login?registered=true")
      } else {
        setError("Username or email already exists")
      }
    } catch {
      setError("Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <button onClick={() => router.push("/")} className="flex items-center">
            <SolarLogo size="md" />
          </button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        currentStep > step.id
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                          : currentStep === step.id
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {currentStep > step.id ? <Check className="w-5 h-5" /> : step.id}
                    </div>
                    <span
                      className={`text-xs mt-2 font-medium hidden sm:block ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {step.name}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 sm:w-12 lg:w-20 h-1 mx-1 sm:mx-2 rounded-full transition-all ${
                        currentStep > step.id ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <CardTitle className="text-xl">Dealer Registration</CardTitle>
              <CardDescription>
                Step {currentStep} of 5: {steps[currentStep - 1].name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => updateFormData("username", e.target.value)}
                      placeholder="Enter username"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => updateFormData("firstName", e.target.value)}
                        placeholder="Enter first name"
                        className="h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => updateFormData("lastName", e.target.value)}
                        placeholder="Enter last name"
                        className="h-11 mt-1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="gender">Gender *</Label>
                      <Select value={formData.gender} onValueChange={(v) => updateFormData("gender", v)}>
                        <SelectTrigger className="h-11 mt-1">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => updateFormData("dateOfBirth", e.target.value)}
                        className="h-11 mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contact Details */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="mobile">Mobile Number *</Label>
                    <Input
                      id="mobile"
                      type="tel"
                      value={formData.mobile}
                      onChange={(e) => updateFormData("mobile", e.target.value)}
                      placeholder="Enter 10-digit mobile number"
                      maxLength={10}
                      className="h-11 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      placeholder="Enter email address"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fatherName">Father&apos;s Name *</Label>
                    <Input
                      id="fatherName"
                      value={formData.fatherName}
                      onChange={(e) => updateFormData("fatherName", e.target.value)}
                      placeholder="Enter father's name"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fatherContact">Father&apos;s Contact (Optional)</Label>
                    <Input
                      id="fatherContact"
                      type="tel"
                      value={formData.fatherContact}
                      onChange={(e) => updateFormData("fatherContact", e.target.value)}
                      placeholder="Enter father's contact number"
                      maxLength={10}
                      className="h-11 mt-1"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Government ID */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="governmentIdType">Government ID Type *</Label>
                    <Select
                      value={formData.governmentIdType}
                      onValueChange={(v) => updateFormData("governmentIdType", v)}
                    >
                      <SelectTrigger className="h-11 mt-1">
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        {governmentIds.map((id) => (
                          <SelectItem key={id} value={id}>
                            {id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="governmentIdNumber">Government ID Number *</Label>
                    <Input
                      id="governmentIdNumber"
                      value={formData.governmentIdNumber}
                      onChange={(e) => updateFormData("governmentIdNumber", e.target.value)}
                      placeholder="Enter ID number"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div>
                    <Label>Government ID Image (Optional)</Label>
                    <div className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/30">
                      <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Address */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="street">Street Address *</Label>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => updateFormData("street", e.target.value)}
                      placeholder="Enter street address"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => updateFormData("city", e.target.value)}
                        placeholder="Enter city"
                        className="h-11 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pincode">Pincode *</Label>
                      <Input
                        id="pincode"
                        value={formData.pincode}
                        onChange={(e) => updateFormData("pincode", e.target.value)}
                        placeholder="Enter 6-digit pincode"
                        maxLength={6}
                        className="h-11 mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Select value={formData.state} onValueChange={(v) => updateFormData("state", v)}>
                      <SelectTrigger className="h-11 mt-1">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {indianStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 5: Security */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => updateFormData("password", e.target.value)}
                      placeholder="Enter password (min 8 characters)"
                      className="h-11 mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                      placeholder="Confirm your password"
                      className="h-11 mt-1"
                    />
                  </div>

                  {/* OTP Verification */}
                  <div className="border border-border rounded-xl p-4 bg-muted/30">
                    <Label className="mb-3 block font-semibold">Mobile Verification *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter 6-digit OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        maxLength={6}
                        disabled={!otpSent || otpVerified}
                        className="h-11"
                      />
                      {!otpSent ? (
                        <Button type="button" onClick={handleSendOtp} className="h-11">
                          Send OTP
                        </Button>
                      ) : !otpVerified ? (
                        <Button type="button" onClick={handleVerifyOtp} className="h-11">
                          Verify
                        </Button>
                      ) : (
                        <Button type="button" disabled className="h-11 bg-green-600 hover:bg-green-600">
                          <Check className="w-4 h-4 mr-1" /> Verified
                        </Button>
                      )}
                    </div>
                    {otpSent && !otpVerified && (
                      <p className="text-xs text-muted-foreground mt-2">
                        OTP sent to {formData.mobile}. Enter any 6-digit code for demo.
                      </p>
                    )}
                  </div>

                  {/* Terms Agreement */}
                  <div className="flex items-start gap-3 p-4 border border-border rounded-xl bg-muted/30">
                    <Checkbox
                      id="terms"
                      checked={agreedToTerms}
                      onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                      I agree to the Terms and Conditions and Privacy Policy of SolarQuote. I confirm that all the
                      information provided is accurate.
                    </Label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-border">
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handleBack} className="flex-1 h-11 bg-transparent">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                {currentStep < 5 ? (
                  <Button onClick={handleNext} className="flex-1 h-11 shadow-lg shadow-primary/25">
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="flex-1 h-11 shadow-lg shadow-primary/25"
                  >
                    {isLoading ? "Creating Account..." : "Complete Registration"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <button onClick={() => router.push("/login")} className="text-primary font-medium hover:underline">
              Login here
            </button>
          </p>
        </div>
      </main>
    </div>
  )
}
