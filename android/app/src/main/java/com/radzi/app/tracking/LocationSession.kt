package com.radzi.app.tracking

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationAvailability
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

interface LocationSessionDelegate {
    fun onLocationReceived(location: Location, mode: LocationSession.AccuracyMode)
    fun onAuthorizationChanged(status: String)
    fun onError(throwable: Throwable)
}

class LocationSession(private val context: Context) {

    enum class AccuracyMode(val raw: String) {
        OFF("off"),
        LOW("low"),
        HUNDRED("hundred"),
        BEST("best");
    }

    var delegate: LocationSessionDelegate? = null
    var currentMode: AccuracyMode = AccuracyMode.OFF
        private set

    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.forEach { loc ->
                delegate?.onLocationReceived(loc, currentMode)
            }
        }
        override fun onLocationAvailability(availability: LocationAvailability) {}
    }

    fun setMode(mode: AccuracyMode) {
        if (mode == currentMode) return
        val previous = currentMode
        currentMode = mode
        TrackingLogger.shared.log(TrackingLogger.Level.info, "LocationSession: ${previous.raw} → ${mode.raw}")

        fusedClient.removeLocationUpdates(callback)

        if (mode == AccuracyMode.OFF) {
            TrackingForegroundService.stop(context)
            return
        }

        TrackingForegroundService.start(context)
        requestUpdates(mode)
    }

    @SuppressLint("MissingPermission")
    private fun requestUpdates(mode: AccuracyMode) {
        if (!hasLocationPermission()) {
            TrackingLogger.shared.log(TrackingLogger.Level.warn, "LocationSession: no location permission")
            return
        }
        val req = when (mode) {
            AccuracyMode.LOW -> LocationRequest.Builder(Priority.PRIORITY_LOW_POWER, 60_000L)
                .setMinUpdateDistanceMeters(100f)
                .setMinUpdateIntervalMillis(30_000L)
                .build()
            AccuracyMode.HUNDRED -> LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10_000L)
                .setMinUpdateDistanceMeters(25f)
                .setMinUpdateIntervalMillis(5_000L)
                .build()
            AccuracyMode.BEST -> LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1_000L)
                .setMinUpdateDistanceMeters(5f)
                .setMinUpdateIntervalMillis(500L)
                .setWaitForAccurateLocation(true)
                .build()
            AccuracyMode.OFF -> return
        }
        fusedClient.requestLocationUpdates(req, callback, Looper.getMainLooper())
            .addOnFailureListener { e ->
                TrackingLogger.shared.log(TrackingLogger.Level.error, "LocationSession: requestUpdates failed — $e")
                delegate?.onError(e)
            }
    }

    /** Stops GPS update callbacks without touching the FGS lifecycle. Used during standalone-to-RN handoff. */
    internal fun stopUpdatesOnly() {
        fusedClient.removeLocationUpdates(callback)
        currentMode = AccuracyMode.OFF
    }

    /** Returns "granted", "whenInUse", or "denied". */
    fun currentAuthorization(): String {
        val fine = ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION)
        val background = ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        return when {
            fine == PackageManager.PERMISSION_GRANTED && background == PackageManager.PERMISSION_GRANTED -> "granted"
            fine == PackageManager.PERMISSION_GRANTED -> "whenInUse"
            else -> "denied"
        }
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
}
